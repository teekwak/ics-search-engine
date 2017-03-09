'use strict';

const async = require('async');
const redis = require('redis');

class RedisConnector {
	constructor() {
		this.client = redis.createClient();
	}

	close() {
		if(this.client === null) {
			console.log("[SERVER]: no Redis connection to close");	
			return;
		}

		this.client.quit();
	}

	getResults(queryParts, outerCallback) {
		async.map(queryParts, function(word, innerCallback) {
			this.client.lrange(word, 0, -1, function(err, reply) {
				if (err) console.log(err);

				return innerCallback(null, reply.map(function(entry) {
					return entry.replace(/['"()\s]/g, "");
				}));
			});
		}.bind({client: this.client}), function(err, results) {
			// AND representation

			// created index pointers
			let maxLength = 0;
			const pointers = [];
			results.forEach(result => {
				pointers.push(0);
				if(result.length > maxLength) maxLength = result.length;
			});

			const returnSet = {}; // page -> tfidf score, convert to array later
			for(let i = 0; i < maxLength; i++) {
				let pointerToIncrement = -1;
				let maxTFIDFPage = '';
				let maxTFIDF = -1;
				for(let j = 0; j < results.length; j++) {
					if(i >= results[j].length) continue;
					const lineSplit = results[j][pointers[j]].split(",");
					const tfidf = parseFloat(lineSplit[1]);

					if(tfidf > maxTFIDF) {
						maxTFIDF = tfidf;
						maxTFIDFPage = lineSplit[0];
						pointerToIncrement = j;
					}
				}

				if(pointerToIncrement != -1) {
					pointers[pointerToIncrement] += 1;	
				}
				
				if(returnSet.hasOwnProperty(maxTFIDFPage)) {
					returnSet[maxTFIDFPage] += maxTFIDF;
				} else {
					returnSet[maxTFIDFPage] = maxTFIDF;
				}

				if(Object.keys(returnSet).length == 10) {
					const returnSetArray = [];

					for(let key in returnSet) {
						returnSetArray.push({id: key, tfidf: returnSet[key]});
					}

					returnSetArray.sort(function(a, b) {
						return b.tfidf - a.tfidf;
					});

					for(let j = 0; j < results.length; j++) {
						if(i >= results[j].length) continue;
						const lineSplit = results[j][pointers[j]].split(",");

						if(Object.keys(returnSet).hasOwnProperty(lineSplit[0])) {
							returnSet[lineSplit[0]] += parseFloat(lineSplit[1]);
							pointers[j] += 1;
						}
					}

					const newReturnSetArray = [];
					for(let key in returnSet) {
						newReturnSetArray.push({id: key, tfidf: returnSet[key]});
					}

					newReturnSetArray.sort(function(a, b) {
						return b.tfidf - a.tfidf;
					});

					let same = true;
					for(let i = 0; i < returnSetArray; i++) {
						if(returnSetArray[i].id != newReturnSetArray[i].id) {
							same = false;
							break;
						}
					}

					if(same) {
						return outerCallback(returnSetArray);
					}
				}
			}

			// if we do not get 10
			if(Object.keys(returnSet).length !== 0) {
				const returnSetArray = [];
				for(let key in returnSet) {
					returnSetArray.push({id: key, tfidf: returnSet[key]});
				}
				return outerCallback(returnSetArray);
			}

			return outerCallback([]);
		});
	}
}

module.exports = RedisConnector;