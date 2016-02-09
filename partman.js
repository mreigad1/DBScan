/********************************
 * partman.js
 ********************************
 * This file contains functions related to partitioning and drawing.
 * Authored by Benjamin Kruger (kruger@nsuok.edu) and modified by James Lemon
 * and Matt Reigada for REU:HIT@UCA, Summer 2013. Funded in part by a grant
 * from the NSF.
 * 
 * Whichever copyright rules applied to code produced by students in 
 * university research, partially funded by a government agency should
 * apply to this code as well.
 */

/**
 * partMan
 * Partition manager. The primary purpose of this function is to determine
 * whether it is necessary to partition the input image before processing
 * and, if so, to partition it into overlapping sections, dubbed shingles (due
 * to the manner in which they overlap)
 * 
 * @param {type} myImg the source image, comprises width, height, and a 2D
 *				 pixel array.
 * @param {type} maxSize the maximum width/height of the (square) shingles.
 * @param {type} eps epsilon (DBSCAN parameter)
 * @param {type} minPts minimum points (DBSCAN parameter)
 * @returns {undefined}
 */
function partMan(myImg, maxSize, eps, minPts) {
	var global = [];			// Merged DBSCAN results
	
	//Whether the user wants console output
	var showdebug = document.getElementById('showdebug').checked; 
	
	// WebCL housekeeping
	var platforms = WebCL.getPlatformIDs();
	var ctx = WebCL.createContextFromType ([WebCL.CL_CONTEXT_PLATFORM, platforms[0]],
													   WebCL.CL_DEVICE_TYPE_DEFAULT);
													   
	// If the image size is under the max partition size (don't partition):													   
	if (myImg.width * myImg.height <= maxSize * maxSize) {

		
		// Send the whole image to DBScan function
		var global = DBScan(ctx, myImg.pixels, myImg.width, myImg.height, eps, minPts);
		
		// resize the canvas element
		setupCanvas(myImg.width, myImg.height);
		
		// For each node in the global result, draw the pixel
		for (var i = 0; i < global.length; i++) {
			for (var j = 0; j < global[i].length; j++) {
				draw(global[i][j]);
			}
		}
		
		if (showdebug) {
			console.log("Partitioning Unnecessary.\n");
			console.log(global);
		}
	} else { 	 	// Else: we'll have to partition		
	 	
	 	// Set partition sizes:
		// corePartSize refers to the part of the shingle excluding the 
		// lap (redundant area).
		var corePartSize = maxSize - (2 * eps + 1);
		var partsPerRow = Math.ceil(myImg.width / corePartSize);
		var partRows = Math.ceil(myImg.height / corePartSize);
		var parts = []; 	// Initialize the array of partition rows
		
		// temSize's members will be altered as the circumstances of the 
		// shingle are determined.
		var tempSize = {
			w: 0,
			h: 0
		};
		
		// For each row of partitions:
		for (var i = 0; i < partRows; i++) {
		
			var currentRow = []; // Initialize the row of partitions
			
			// For each partition in the row:
			for (var j = 0; j < partsPerRow; j++) {
			

				// If the current column is the last one, assign it a special width.
				//   else: assign maxSize to its width:
				if (j == partsPerRow -1) {
					
					// Assign the remainder to the width
					var lastColumnWidth = myImg.width % corePartSize;
					
					// If there is no remainder, then assign core size
					if (lastColumnWidth == 0) {
						lastColumnWidth = corePartSize;
					}
					tempSize.w = lastColumnWidth;
				} else {
					tempSize.w = maxSize;
				}
				
				// If the current row is last row, assign it a special height.
				// Else: assign maxSize to its height
				if (i == partRows - 1) {
					var lastRowHeight = myImg.height % corePartSize;
					if (lastRowHeight == 0) {
						lastRowHeight = corePartSize;
					}
					tempSize.h = lastRowHeight;
				} else {
					tempSize.h = maxSize;
				}
				
				// Special Case: Image needs to be partitioned, 
				// but the partition size is greater than one 
				// of the dimensions  of the image.
				if (tempSize.h > myImg.height) {
					tempSize.h = myImg.height;
				}
				if (tempSize.w > myImg.width) {
					tempSize.w = myImg.width;
				}
				
				// Add the partition to the collection
				currentRow.push(new Part(j * corePartSize, i * corePartSize, 
								tempSize.w, tempSize.h));
			}
			
			// Add the row to the collection
			parts.push(currentRow);
		}
		
		
		// For each partition:
		for (var i = 0; i < partRows; i++) {
			for (var j = 0; j < partsPerRow; j++) {
				
				// Fill in its pixels array.
				setPartPixels(parts[i][j],myImg.pixels);
				
				// Send the partition to DBScan
				var clusters = DBScan(ctx, parts[i][j].pixels, parts[i][j].width, parts[i][j].height, eps, minPts);
				
				// Debugging output
				if (showdebug) {
					console.log("Partition number: " + 
							parseInt(i * partsPerRow + j) + "\n");
					console.log("Offset: (" + parts[i][j].x_offset + ", " + 
							parts[i][j].y_offset + "); Size: "+ 
							parts[i][j].width + " x " + parts[i][j].height + 
							".\n");
					console.log(clusters);
				}
				
				// Merge the current partition into the global object
				global = mergeToGlobal(clusters, global, parts[i][j].width, 
									parts[i][j].height, myImg.width, 
									myImg.height, parts[i][j].x_offset, 
									parts[i][j].y_offset);
				
				// Debugging output
				if (showdebug) {
					console.log(global);
				}

			}
		}
		
		// Debugging output
		if(showdebug){
			console.log("Final Image");
			console.log(global);	
		}
		
		// Prepare the canvas with the proper image size
		setupCanvas(myImg.width, myImg.height);
		
		// Draw each pixel in the global object to the canvas
		for (var i = 0; i < global.length; i++) {
			for (var j = 0; j < global[i].length; j++) {
				for (var k = 0; k < global[i][j].length; k++) {
					draw(global[i][j][k]);
				}
			}
		}
	}
}

/*
 * setPartPixels
 * Fills out the pixels array for a given partition
 * @param {type} part the partition for which the pixel array will be 
 *				 populated.
 * @param {type} source the full, original image.
 * @returns {undefined}
 */
function setPartPixels(part, source) {
	var i = 0; // Row index for destination.
	var si = part.y_offset; // Row index for source.
	var j = 0; // Column index for destination.
	var sj = part.x_offset; // Column index for source.
	
	// For each row in the partition:
	for (i = 0; i < part.height; i++) {
		si = i + part.y_offset; // Increment source index to match.
		part.pixels.push([]); // Add a new row to the partition.
		

			// For each column in the row:
			for (j = 0; j < part.width; j++) {
				sj = j + part.x_offset; // Increment source index to match.
				part.pixels[i].push(source[si][sj]); // Add a column to the row.
													 // copied from the source.
		}
	}
}

/**
 * Part
 * Constructor for Part objects (Shingle Partitions). 
 * @param {Object} x_offset 
 * @param {Object} y_offset
 * @param {Object} width
 * @param {Object} height
 */
function Part(x_offset, y_offset, width, height) {
	this.pixels = [];
	this.x_offset = x_offset;
	this.y_offset = y_offset;
	this.width = width;
	this.height = height;
}

/**
 * setupCavnas
 * Creates the canvas context with a specified size.
 * @param {Object} w width
 * @param {Object} h height
 */
function setupCanvas(w,h) {
	var ctx = document.getElementById('canvas').getContext('2d');
	ctx.canvas.width = w;
	ctx.canvas.height = h;
}

/**
 * draw
 * Draws a point onto the canvas  
 * @param {Object} n point, containing x and y coordinate members and node 
 *		   type (b (border), c (core), n (noise)).
 */
function draw(n) {
	var x = n.x;
	var y = n.y;
	var t = n.b;
	var ctx = document.getElementById('canvas').getContext('2d');
	
	var maxColor = 255;
	var cDom = 20;
	var fill = n.r % (cDom*cDom*cDom);	//root mod 8000
	var redFill = (fill % cDom);		//get redVal
	var greenFill = (Math.floor(fill / cDom) % cDom);	//get greenVal
	var blueFill = (Math.floor(fill / (cDom * cDom)) % cDom);	//get blueVal
	var borderOffset = Math.floor(maxColor / 3);	//value for border- 
													//intensity offset

	//20 varying intensities of each color, align 20 intensities to appropriate domain
	redFill = (redFill * Math.floor((maxColor - borderOffset) / cDom)) + borderOffset;			
	greenFill = (greenFill * Math.floor((maxColor - borderOffset) / cDom)) + borderOffset;
	blueFill = (blueFill * Math.floor((maxColor - borderOffset) / cDom)) + borderOffset;

	if(t !== 'c'){
		redFill = maxColor - redFill;	//invert color if border
		greenFill = maxColor - greenFill;
		blueFill = maxColor - blueFill;

		var intensity = blueFill + greenFill + redFill;
		intensity = Math.floor(intensity / 3);

		//heuristic for determining low contrast hues
		if(intensity >= Math.floor(maxColor / 3) && intensity <= 2*Math.floor(maxColor / 3)){		
			redFill = redFill - borderOffset;
			greenFill = greenFill - borderOffset;
			blueFill = blueFill - borderOffset;
		}
	}

	// Set the fill color as determined above.
	ctx.fillStyle = "rgb(" + redFill + "," + greenFill + "," + blueFill + ")";
	
	// Plot the point on the canvas.
	ctx.fillRect (x, y, 1, 1);

}
