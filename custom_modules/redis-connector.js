'use strict';

const _ = require('lodash');
const async = require('async');
const redis = require('redis');

class RedisConnector {
	constructor() {
		this.client = redis.createClient();
	}

	// close connection to Redis
	// return type: void
	close() {
		if(this.client !== null) {
			this.client.quit();
		}
	}

	// compare arrays of objects with id property
	// return type: boolean
	compareIds(originalArray, comparedArray) {
		let same = true;
		for(let i = 0; i < originalArray.length; i++) {
			if(originalArray[i].id != comparedArray[i].id) {
				same = false;
				break;
			}
		}
		return same;
	}

	// sort by TF-IDF in descending order
	// return type: number
	sortByTFIDF(a, b) {
		// sort by id if TF-IDF score is close enough
		if(Math.abs(b.tfidf - a.tfidf) < 0.000001) {
			if(a.id > b.id) return 1;
			else if(a.id < b.id) return -1;
			return 0;
		}

		return b.tfidf - a.tfidf;
	}

	// gets the urls for the page objects
	// return type: array of objects
	getPageURLs(pageObjects, callback) {
		async.map(pageObjects, function(obj, innerCallback) {
			this.client.get('&_' + obj.id, function(err, reply) {
				if (err) console.log(err);

				return innerCallback(null, {id: obj.id, url: reply});
			});
		}.bind({client: this.client}), function(err, results) {
			results.forEach(result => {
				pageObjects.forEach(pageObject => {
		  		if(result.id === pageObject.id) {
		  			pageObject.url = result.url;
		  		}
				});
			});

			return callback(pageObjects);
		});
	}

	// gets the results based on a query using an AND representation
	// return type: array of objects
	getResults(queryParts, numberOfResults, outerCallback) {
		async.map(queryParts, function(word, innerCallback) {
			this.client.lrange(word, 0, -1, function(err, reply) {
				if (err) console.log(err);

				return innerCallback(null, reply.map(function(entry) {
					return entry.replace(/['"()\s]/g, "");
				}));
			});
		}.bind({client: this.client}), function(err, results) {
			// create mappings
			let idToIndexMapping = {};
			let returnSet = [];

			// created index pointers
			let maxLength = 0;
			const pointers = [];
			results.forEach(result => {
				pointers.push(0);
				if(result.length > maxLength) maxLength = result.length;
			});

			// loop begins
			for(let index = 0; index < maxLength; index++) {
				if(Object.keys(returnSet).length >= numberOfResults) {
					returnSet.sort(this.sortByTFIDF);

					// clone returnSet and see if adding the frontier will change anything
					let returnSetClone = _.cloneDeep(returnSet);

					// add entire frontier to return set
					for(let j = 0; j < results.length; j++) {
						if(index >= results[j].length) continue;
						const lineSplit = results[j][pointers[j]].split(",");

						if(idToIndexMapping.hasOwnProperty(lineSplit[0])) {
							returnSetClone[idToIndexMapping[lineSplit[0]]].tfidf += parseFloat(lineSplit[1]);
							pointers[j] += 1;
						} else {
							returnSetClone.push({ id: lineSplit[0], tfidf: parseFloat(lineSplit[1]) });
							idToIndexMapping[returnSetClone.length] = lineSplit[0];
						}
					}

					// sort in descending order of TF-IDF
					returnSetClone.sort(this.sortByTFIDF);

					returnSet = returnSet.slice(0, numberOfResults);
					returnSetClone = returnSetClone.slice(0, numberOfResults);

					if(this.compareIds(returnSet, returnSetClone)) {
						return outerCallback(returnSet);
					} else {
						returnSet = returnSetClone;
					}
				}

				// get next highest TF-IDF scoring page id
				let pointerToIncrement = -1;
				let maxTFIDFPageID = '';
				let maxTFIDF = -1;
				for(let j = 0; j < results.length; j++) {
					if(index >= results[j].length) continue;
					const lineSplit = results[j][pointers[j]].split(",");
					const tfidf = parseFloat(lineSplit[1]);

					if(tfidf > maxTFIDF) {
						maxTFIDF = tfidf;
						maxTFIDFPageID = lineSplit[0];
						pointerToIncrement = j;
					}
				}

				// increment pointer
				if(pointerToIncrement != -1) {
					pointers[pointerToIncrement] += 1;
				}

				// add TF-IDF value to result set and update id to index mapping
				if(idToIndexMapping.hasOwnProperty(maxTFIDFPageID)) {
					returnSet[idToIndexMapping[maxTFIDFPageID]].tfidf += maxTFIDF;
				} else {
					idToIndexMapping[maxTFIDFPageID] = returnSet.length;
					returnSet.push({id: maxTFIDFPageID, tfidf: maxTFIDF});
				}
			}

			return Object.keys(returnSet).length !== 0 ? outerCallback(returnSet): outerCallback([]);
		}.bind(this));
	}
}

module.exports = RedisConnector;