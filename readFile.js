/********************************
 * readFile.js
 ********************************
 * This file contains functions related to opening, reading and parsing PBM 
 * image files. Because this file receives control first upon a user's file
 * selection, and control is returned to it upon completion of border the 
 * border detection, the timer is locatied within.
 * 
 * Authored by Benjamin Kruger (kruger@nsuok.edu) for REU:HIT@UCA, Summer 2013.
 * Funded in part by a grant from the NSF.
 * 
 * This file contains a function authored by John Resig and MIT licensed. Where
 * that function is included, so is the author's original comment regarding 
 * authorship and licensing.
 * 
 * Whichever copyright rules applied to code produced by students in 
 * university research, partially funded by a government agency should
 * apply to this code as well.
 */


/**
 * readOneFile
 * This function is triggered when a user selects a file using the input on the
 * HTML form. It reads the file, determines the image size, strips out comments
 * and extraneous spaces.
 *
 ***********NOTE***************
 * This parser fails when the input file is wrapped -- (newlines added).
 ****************************** 
 * 
 * @param {type} e the event (file input is changed) triggering the function.
 * @returns {undefined}
 */
function readOneFile(e) {
	
	
	var maxSize = parseInt(document.getElementById('maxsize').value);

	eps = parseInt(document.getElementById('eps').value);
	minPts = parseInt(document.getElementById('minPts').value);
	points = []; // Empty array, will hold the points gleened from parsing.
	
	var f = e.target.files[0]; // The first file in the file list.
	if (f) {
		
		fileName = f.name; // Global variable to maintain awareness of the
						   // file's name.
						   
		var r = new FileReader();
		
		/**
		 * annonymous function
		 * This function is triggered when the file loading is complete.
		 * This is where the parsing happens.
		 * @param {type} e
		 * @returns {unresolved}
		 */
		r.onload = function(e) {
			var contents = e.target.result;				
			var lines = contents.split("\n");
			
			// Stop execution if file is not a proper file. 
			if (!(lines[0][0] == "P" && lines[0][1] == "1")) {
				alert("Can't find \"magic number\" in .pbm file.");
				return;
			}
			
			// Remove the magic number line ("P1\n")
			lines.remove(0);
			
			// Strip out all comment lines
			for (var i = 0; i < lines.length; i++) {
				if (lines[i][0] == '#') {
					lines.remove(i);
				}
			}
			
			// Use RegExp to extract the width and height from the
			//  first of the remaining lines.
			var matchArray = lines[0].match(/^(\d+) (\d+)/)
			if (matchArray.length != 3) {
				alert("Improper size declaration in .pbm file.");
				return;
			}
			
			// Set the image dimensions to be the same as those declared in the
			// PBM file.
			var imageWidth = parseInt(matchArray[1]);
			var imageHeight = parseInt(matchArray[2]);
			
			// Remove the width and height declaration line.
			lines.remove(0);

			// For each row:
			for (var i = 0; i < imageHeight; i++) {
				
				// Strip out all the spaces.
				lines[i] = lines[i].replace(/\s+/g, '');
				
				// Add an empty array to points.
				points.push([]);
				
				// For each character:
				for (var j = 0; j < imageWidth; j++) {
					
					// Push the numerical equivalent of the character
					//  onto the points 2D array.
					if (lines[i][j] == '1') {
					    points[i].push(1);
					} else {
					    points[i].push(0);
					}
				}
			}
			
			// Create an object literal to contain the image
			//  and its width/height data.
			var myImg = {
				pixels: points,
				width: imageWidth,
				height: imageHeight
			};
			
			// Start the timer.
			var startTime = new Date().getTime();
			
			// Send the image and processing parameters to partition manager.
			partMan(myImg, maxSize, eps, minPts);
			
			// Stop the timer.
			var endTime = new Date().getTime();
			
			// Measure the elapsed time.
			var timeElapsed = endTime-startTime;
			
			// Log the file name and elapsed time.
			console.log(fileName + ': ' + timeElapsed);
		}
		
		// Read the file as ASCII text.
		r.readAsText(f);
	} else {
		alert("Failed to open file.");
	}
}

fileName = ''; // Global variable to maintain the file's name.

// Adds the event trigger to read the file.
document.getElementById('begin').addEventListener('change', readOneFile, false);


// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};
