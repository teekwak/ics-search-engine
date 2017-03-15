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

	// sort by relevance score in descending order
	// return type: number
	sortByScore(a, b) {
		// sort by id if TF-IDF score is close enough
		if(Math.abs(b.score - a.score) < 0.000001) {
			if(a.id > b.id) return 1;
			else if(a.id < b.id) return -1;
			return 0;
		}

		return b.score - a.score;
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

	// get the results based on a query using an OR representation
	// return type: array of objects
	getORResults(queryParts, numberOfResults, outerCallback) {
		async.map(queryParts, function(word, innerCallback) {
			this.client.lrange(word, 0, -1, function(err, reply) {
				if (err) console.log(err);

				return innerCallback(null, reply.map(function(entry) {
					return entry.replace(/['"()\s]/g, "");
				}));
			});
		}.bind({client: this.client}), function(err, results) {
			let maxLength = -1;
			let hasEmptyResult = false;
			results.forEach(result => {
				if(result.length > maxLength) {
					maxLength = result.length;
				} else if(result.length === 0) {
					hasEmptyResult = true;
				}
			});

			if(hasEmptyResult) {
				return outerCallback([]);
			}

			const returnSet = [];
			const idToOccurrence = {};
			const idToRelevanceScore = {};
			for(let index = 0; index < maxLength; index++) {
				for(let j = 0; j < results.length; j++) {
					if(results[j].length <= index) continue;

					const pageValueAtIndex = results[j][index].split(',');

					if(idToOccurrence.hasOwnProperty(pageValueAtIndex[0])) {
						idToOccurrence[pageValueAtIndex[0]] += 1;
					} else {
						idToOccurrence[pageValueAtIndex[0]] = 1;
						idToRelevanceScore[pageValueAtIndex[0]] = pageValueAtIndex[1];
					}

					if(idToOccurrence[pageValueAtIndex[0]] == results.length) {
						returnSet.push({id: pageValueAtIndex[0], score: pageValueAtIndex[1]});
					}
				}

				if(returnSet.length == numberOfResults) {
					returnSet.sort(this.sortByScore);
					return outerCallback(returnSet);
				}
			}

			returnSet.sort(this.sortByScore);
			return outerCallback(returnSet);
		}.bind(this));
	}

	// gets the results based on a query using an AND representation
	// return type: array of objects
	getANDResults(queryParts, numberOfResults, outerCallback) {
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
					returnSet.sort(this.sortByScore);

					// clone returnSet and see if adding the frontier will change anything
					let returnSetClone = _.cloneDeep(returnSet);

					// add entire frontier to return set
					for(let j = 0; j < results.length; j++) {
						if(index >= results[j].length) continue;
						const lineSplit = results[j][pointers[j]].split(",");

						if(idToIndexMapping.hasOwnProperty(lineSplit[0])) {
							returnSetClone[idToIndexMapping[lineSplit[0]]].score += parseFloat(lineSplit[1]);
							pointers[j] += 1;
						} else {
							returnSetClone.push({ id: lineSplit[0], score: parseFloat(lineSplit[1]) });
							idToIndexMapping[returnSetClone.length] = lineSplit[0];
						}
					}

					// sort in descending order of TF-IDF
					returnSetClone.sort(this.sortByScore);

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
				let maxScorePageID = '';
				let maxScore = -1;
				for(let j = 0; j < results.length; j++) {
					if(index >= results[j].length) continue;
					const lineSplit = results[j][pointers[j]].split(",");
					const score = parseFloat(lineSplit[1]);

					if(score > maxScore) {
						maxScore = score;
						maxScorePageID = lineSplit[0];
						pointerToIncrement = j;
					}
				}

				// increment pointer
				if(pointerToIncrement != -1) {
					pointers[pointerToIncrement] += 1;
				}

				// add TF-IDF value to result set and update id to index mapping
				if(idToIndexMapping.hasOwnProperty(maxScorePageID)) {
					returnSet[idToIndexMapping[maxScorePageID]].score += maxScore;
				} else {
					idToIndexMapping[maxScorePageID] = returnSet.length;
					returnSet.push({id: maxScorePageID, score: maxScore});
				}
			}

			return Object.keys(returnSet).length !== 0 ? outerCallback(returnSet): outerCallback([]);
		}.bind(this));
	}
}

module.exports = RedisConnector;