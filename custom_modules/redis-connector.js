'use strict';

const _ = require('lodash');
const async = require('async');
const redis = require('redis');

class RedisConnector {
	constructor() {
		this.client = redis.createClient();
		this.pageRankWeight = 1000;
		this.cosineSimilarityWeight = 1.0;
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
			this.client.get('&id_' + obj.id, function(err, reply) {
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

	// adds page rank scores from Redis database to current scores
	// return type: array of objects
	addPageRankScores(pageObjects, numberOfResults, outerCallback) {
		const PAGERANK_WEIGHT = this.pageRankWeight;

		async.map(pageObjects, function(obj, innerCallback) {
			this.client.get('&pr_' + obj.id, function(err, reply) {
				if(err) console.log(err);

				obj.score += PAGERANK_WEIGHT * parseFloat(reply);

				return innerCallback(null, obj);
			});
		}.bind({client: this.client}), function(err, results) {
			return outerCallback(results.sort(function(a, b) {
				if(Math.abs(b.score - a.score) < 0.000001) {
					if(a.id > b.id) return 1;
					else if(a.id < b.id) return -1;
					return 0;
				}

				return b.score - a.score;
			}).slice(0, numberOfResults));
		});
	}

	// get the magnitude of the page
	// return type: array of objects {id, score}
	addMagnitude(pageObjects, outerCallback) {
		async.map(pageObjects, function(obj, innerCallback) {
			this.client.get('&mag_' + obj.id, function(err, reply) {
				if(err) console.log(err);

				obj.magnitude = parseFloat(reply);

				return innerCallback(null, obj);
			});
		}.bind({client: this.client}), function(err, results) {
			return outerCallback(results);
		});
	}

	// compute weighted cosine similarity and weighted pagerank sum
	// return type: array of objects {id, score}
	addCosineSimilarityScores(queryParts, pageObjects, outerCallback) {
		const COSINE_SIMILARITY_WEIGHT = this.cosineSimilarityWeight;

		const queryWordCounts = {};
		queryParts.forEach(word => {
			if(!queryWordCounts.hasOwnProperty(word)) {
				queryWordCounts[word] = 0;
			}
			queryWordCounts[word] += 1;
		});

		// make all database query strings first
		const dbQueries = [];
		new Set(queryParts).forEach(part => {
			pageObjects.forEach(obj => {
				dbQueries.push('&wc_' + obj.id + '_' + part);
			});
		});

		async.map(dbQueries, function(query, innerCallback) {
			this.client.get(query, function(err, reply) {
				if(err) console.log(err);

				const splitQuery = query.split('_');
				return innerCallback(null, {id: splitQuery[1], word: splitQuery[2], wc: reply});
			});
		}.bind({client: this.client}), function(err, results) {
			// combine results by id
			const pageDataMapping = {};
			results.forEach(result => {
				if(!pageDataMapping.hasOwnProperty(result.id)) {
					pageDataMapping[result.id] = {};
				}

				pageDataMapping[result.id][result.word] = result.wc;
			});

			// combine pageDataMapping and pageObjects
			pageObjects.forEach(pageObject => {
				pageObject.words = pageDataMapping[pageObject.id];
			});

			// compute magnitude of query
			const magnitudeOfQuery = Math.sqrt((Object.values(queryWordCounts).map(function(value) {
				return value * value;
			})).reduce(function(accumulated, value) {
				return accumulated + value;
			}, 0));

			// calculate dot product between query and document
			// assign score to object
			pageObjects.forEach(pageObject => {
				let dotProduct = 0;
				Object.keys(queryWordCounts).forEach(key => {
					dotProduct += queryWordCounts[key] * pageObject.words[key];
				});

				pageObject.score = COSINE_SIMILARITY_WEIGHT * (dotProduct / (magnitudeOfQuery * pageObject.magnitude));
			});

			return outerCallback(pageObjects);
		});
	}


	// get the results based on a query using an OR representation
	// return type: array of objects {id, score}
	getMatchingResults(queryParts, outerCallback) {
		async.map(queryParts, function(word, innerCallback) {
			this.client.lrange(word, 0, -1, function(err, reply) {
				if(err) console.log(err);

				return innerCallback(null, reply.map(function(entry) {
					return entry.replace(/['"()\s]/g, "");
				}));
			});
		}.bind({client: this.client}), function(err, results) {
			const emptyResults = _.filter(results, function(result) {
				return result.length === 0;
			});

			if(emptyResults.length > 0) {
				return outerCallback([]);
			}

			const returnedResults = [];
			_.intersection.apply(_, results).forEach(entry => {
				returnedResults.push({id: entry, score: 0.0});
			});

			return outerCallback(returnedResults);
		});
	}
}

module.exports = RedisConnector;