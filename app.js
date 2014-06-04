#!/usr/bin/env node

var http = require('http');
var ProgressBar = require('progress');
var fs = require('fs');


// Parse arguments
var buffer;
var fileName;
process.argv.slice(1).forEach(function (val, index, arr) {
	if(val === '-h' || process.argv.length === 2) {
		console.info(
"Usage: franceculture-dl [-hn] <url>\n\
 -h \t help\n\
 -n \t name"
			);
		buffer = false;
	} else if(index !== 0) {
		if(buffer !== false) {
			if(val === '-n') {
				if(arr[index + 1]) {
					fileName = arr[index + 1];
				}
			} else if(val[0] === '-') {
				console.warn("Invalid argument " + val);
			} else {
				// url
				var url = arr[arr.length - 1];
				analyseUrl(url);
				buffer = false;
			}
		}
	}
});

/**
 * Analyse url to use the right method to download audio
 *
 * @param {string} url Url of the page.
 */
function analyseUrl(url) {
	if(!url.match(/franceculture\.fr/)) {
		console.warn("Invalid url");
		return false;
	} else if(!url.match(/^http:\/\//)) {
		url = 'http://' + url;
	}

	if(url.match(/podcast/)) {
		downloadPodcast(url);
	} else if(url.match(/player/)) {
		downloadAudio(url);
	} else {
		downloadProgram(url);
	}
}

/**
 * Get the audio file from France Culture page
 *
 * @param {string} url Url of the page.
 */
function downloadAudio(url) {
	getUrlContent(url, function(html) {
		var match = html.match(/&urlAOD\=([\w%-\.]+\.MP3)&startT/i);

		if(match !== undefined && match.length > 0) {
			var urlAudio = "http://www.franceculture.fr/" + unescape(match[1]);

			console.log(fileName);

			if(fileName === undefined) {
				match = html.match(/class="title emission">([^<]+)<\/span/);
				var emission = match[1].trim();
	 
				match = html.match(/class="title diffusion">([^<]+)<\/span/);
				var diffusion = match[1].trim();
	 
				match = html.match(/class="author">([^<]+)<\/span/);
				var author = match[1].trim();

				fileName = emission + ' - ' + diffusion + ' [' + author + ']';
				fileName = fileName.replace(' : ', ' - ');
				fileName = fileName.replace(/[:\\\/?<>\|]/g, '') + '.mp3';
			} else {
				fileName += '.mp3';
			}

			console.log('> Filename: ' + fileName);

			if (fs.existsSync(fileName)) {
				console.log('> File already exists !');
			} else {
				getUrlContent(urlAudio, function(data) {}, fileName);
			}
		}
	});
}

/**
 * Get data from internet.
 *
 * @param {string} url Url of the page.
 * @param {function} callback Callback when data are downloaded.
 * @param {string} (fileName) Optional Write data.
 */
function getUrlContent(url, callback, fileName) {
	var urlToken = require('url').parse(url);
	var data = '';
	var req = http.request({host: urlToken.host, path: urlToken.path});

	req.on('response', function(res) {
		if(fileName) {
			var len = parseInt(res.headers['content-length'], 10);

			var bar = new ProgressBar(' downloading [:bar] :percent :etas', {
				incomplete: ' ',
				width: 30,
				total: len
			});

			res.on('data', function (chunk) {
				bar.tick(chunk.length);

				fs.appendFile(fileName + '.tmp', chunk);
			});
		} else {
			res.setEncoding('utf8');
			res.on('data', function (chunk) {
				data += chunk;
			});
		}

		res.on('end', function() {
			if(fileName) {
				fs.renameSync(fileName + '.tmp', fileName);
			}
			callback(data);
		})
	});

	req.on('error', function(e) {
		console.log('problem with request: ' + e.message);
	});

	req.end();
}
 
/**
 * Download program
 *
 * @param {string} url Url of the page.
 */
function downloadProgram(url) {
	getUrlContent(url, function(html) {
		var match = html.match(/ href="\/player\/reecouter\?play=(\d+)">/);
		downloadAudio('http://www.franceculture.fr/player/reecouter?play=' + match[1]);
	});
}

/**
 * Download all programs from podcast
 *
 * @param {string} url Url of the page.
 */
function downloadPodcast(url) {
	getUrlContent(url, function(html) {
		var reg = /a href="([\w-_\/]+)" title="Audio"/g;
		match = reg.exec(html);

		while (match != null) {
		    match = reg.exec(html);
		    if(match && match.length > 0) {
		    	analyseUrl('http://www.franceculture.fr/' + match[1]);
		    }
		}
	});
}
