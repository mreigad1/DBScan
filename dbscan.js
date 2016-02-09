//creates the global array stencil for iterating the epsilon neighborhood
//Epsilon-the Radius used for manhattan distance circle
function createIndexMap(epsilon){
	var xbuff = [];
	var ybuff = [];
	var keps = (2 * (epsilon * (epsilon + 1)));
	for(var x = -epsilon; x <= epsilon; x++){
		for(var y = -epsilon; y <= epsilon; y++){
			if(((Math.abs(x) + Math.abs(y)) <= epsilon) && (x !== 0 || y !== 0)){
				xbuff.push(x);
				ybuff.push(y);
			}
		}
	}
	//printbuff(xbuff, ybuff, keps);
	var map = { xoffset:xbuff, yoffset:ybuff };
	//console.log(map);
	return map;
}

//function for creating a node:  x-pos, y-pos, r-root, b-border,density, noise
//object for representation of a node
function node(x, y, r, b){
	this.x = x;
	this.y = y;
	this.r = r;
	this.b = b;
}

//creates a list where each entry is a list of nodes contained within the given cluster
//obsolete function, shouldn't be implemented in code
function createClusterList(roots, nodecount, minpts, l, w){
	var clustersused = [];
	var clustercollection = [];
	for(var i = 0; i < roots.length; i++){
		if(clustersused.indexOf(roots[i]) === -1){
			var cluster = [];
			clustersused.push(roots[i]);
			var b = 'b';
			if(nodecount[i] >= minpts){
				b = 'c';}
			if(nodecount[i] === l * w + 2){
				b = 'n';}
			cluster.push(new node((i % l), (Math.floor(i / l)), roots[i], b));
			for(var j = i + 1; j < roots.length; j++){
				if(roots[j] === roots[i]){
					var b = 'b';
					if(nodecount[j] >= minpts){
						b = 'c';}
					if(nodecount[j] === l * w + 2){
						b = 'n';}
						cluster.push(new node((j % l), (Math.floor(j / l)), roots[j], b));}}
			clustercollection.push(cluster);}}
			return clustercollection;
}

//determines every clusters root node
function ReduceRoot(ctx, nodecount, image, l, w, eps, minPts){
	var offsetmap = createIndexMap(eps);
	var device_image = ctx.createBuffer(WebCL.CL_MEM_READ_ONLY, l * w * 4);
	var device_nodecount = ctx.createBuffer(WebCL.CL_MEM_READ_ONLY, l * w * 4);
	var device_xoffset = ctx.createBuffer(WebCL.CL_MEM_READ_ONLY, offsetmap.xoffset.length * 4);
	var device_yoffset = ctx.createBuffer(WebCL.CL_MEM_READ_ONLY, offsetmap.xoffset.length * 4);
	var device_roots = ctx.createBuffer(WebCL.CL_MEM_READ_ONLY, l * w * 4);

	var uintimage = new Uint32Array(l * w);
	var xoffset = new Float32Array(offsetmap.xoffset.length);
	var yoffset = new Float32Array(offsetmap.xoffset.length);
	var roots = new Uint32Array(l * w);

	for(var i = 0; i < l * w; i++){
		roots[i] = i;}
	for(var i = 0; i < l; i = i + 1){
		for(var j = 0; j < w; j = j + 1){
			uintimage[i * w + j] = image[i][j];}}


	for(var i = 0; i < offsetmap.xoffset.length; i++){
		xoffset[i] = offsetmap.xoffset[i];
		yoffset[i] = offsetmap.yoffset[i];}
	var kernelSrc = loadKernel("ReduceRoot");
	var program = ctx.createProgramWithSource(kernelSrc);
	var devices = ctx.getContextInfo(WebCL.CL_CONTEXT_DEVICES);
	try {
					program.buildProgram ([devices[0]], "");
				  } catch(e) {
					alert ("Failed to build WebCL program. Error "
						   + program.getProgramBuildInfo (devices[0], WebCL.CL_PROGRAM_BUILD_STATUS)
						   + ":  " + program.getProgramBuildInfo (devices[0], WebCL.CL_PROGRAM_BUILD_LOG));
					throw e;
				  }
	var kernel = program.createKernel("ReduceRoot");

	kernel.setKernelArg(0, device_image);
	kernel.setKernelArg(1, device_roots);
	kernel.setKernelArg(2, device_nodecount);
	kernel.setKernelArg(3, device_xoffset);
	kernel.setKernelArg(4, device_yoffset);
	kernel.setKernelArg(5, l, WebCL.types.UINT);
	kernel.setKernelArg(6, w, WebCL.types.UINT);
	kernel.setKernelArg(7, eps, WebCL.types.UINT);
	kernel.setKernelArg(8, minPts, WebCL.types.UINT);
	kernel.setKernelArg(9, offsetmap.xoffset.length, WebCL.types.UINT);


	var devices = ctx.getContextInfo(WebCL.CL_CONTEXT_DEVICES);
	var cmdQueue = ctx.createCommandQueue(devices[0], 0);
	cmdQueue.enqueueWriteBuffer (device_image, false, 0, l * w * 4, uintimage, []);
	cmdQueue.enqueueWriteBuffer (device_nodecount, false, 0, l * w * 4, nodecount, []);
	cmdQueue.enqueueWriteBuffer (device_xoffset, false, 0, offsetmap.xoffset.length * 4, xoffset, []);
	cmdQueue.enqueueWriteBuffer (device_yoffset, false, 0, offsetmap.xoffset.length * 4, yoffset, []);
	cmdQueue.enqueueWriteBuffer (device_roots, false, 0, l * w * 4, roots, []);

	var localWS = [512];
	var globalWS = [Math.ceil (l * w / localWS) * localWS];


	cmdQueue.enqueueNDRangeKernel(kernel, globalWS.length, [], globalWS, localWS, []);
	cmdQueue.enqueueReadBuffer (device_roots, true, 0, l * w * 4, roots, []);

	var roots = Uint32Array(l * w);
	cmdQueue.enqueueReadBuffer (device_roots, false, 0, l * w * 4, roots, []);
	var sum = 0;
	for(var i = 0; i < l * w; i++){
		sum = sum + roots[i];}
	var sum2 = 1;
	while(sum !== sum2){
		sum2 = sum;
		sum = 0;
		cmdQueue.enqueueNDRangeKernel(kernel, globalWS.length, [], globalWS, localWS, []);
		cmdQueue.enqueueReadBuffer (device_roots, true, 0, l * w * 4, roots, []);
		cmdQueue.finish();
			for(var i = 0; i < l * w; i++){
				sum = sum + roots[i];}}
	roots = runCleanRoots(ctx, device_image, device_roots, l, w);

	return roots;
}

//gets rid of one root node clusters
function runCleanRoots(ctx, device_image, device_roots, l, w){
	var kernelSrc = loadKernel("CleanRoot");
	var program = ctx.createProgramWithSource(kernelSrc);
	var devices = ctx.getContextInfo(WebCL.CL_CONTEXT_DEVICES);
	try {
					program.buildProgram ([devices[0]], "");
				  } catch(e) {
					alert ("Failed to build WebCL program. Error "
						   + program.getProgramBuildInfo (devices[0], WebCL.CL_PROGRAM_BUILD_STATUS)
						   + ":  " + program.getProgramBuildInfo (devices[0], WebCL.CL_PROGRAM_BUILD_LOG));
					throw e;
				  }
	var kernel = program.createKernel ("CleanRoot");

	kernel.setKernelArg(0, device_roots);
	kernel.setKernelArg(1, device_image);
	kernel.setKernelArg(2, l, WebCL.types.UINT);
	kernel.setKernelArg(3, w, WebCL.types.UINT);
	var devices = ctx.getContextInfo(WebCL.CL_CONTEXT_DEVICES);
	var cmdQueue = ctx.createCommandQueue(devices[0], 0);

	var localWS = [30];
	var globalWS = [Math.ceil (l * w / localWS) * localWS];

	cmdQueue.enqueueNDRangeKernel(kernel, globalWS.length, [], globalWS, localWS, []);

	var roots = Uint32Array(l * w);
	cmdQueue.enqueueReadBuffer (device_roots, false, 0, l * w * 4, roots, []);
	return roots;
};

function loadReduceRootData(kernel, device_image, device_roots, device_mincounts, l, w, eps, minPts, nodecount){
	kernel.setKernelArg(0, device_image);
	kernel.setKernelArg(1, device_roots);
	kernel.setKernelArg(2, device_mincounts);
	kernel.setKernelArg(3, l, WebCL.types.UINT);
	kernel.setKernelArgs(4, w, WebCL.types.UINT);
	kernel.setKernelArgs(5, eps, WebCL.types.UINT);
	kernel.setKernelArgs(6, minPts, WebCL.types.UINT);
	kernel.setKernelArgs(7, nodecont, WebCL.types.UINT);
}

//creates array of number of neighbors in epsilon neighborhood
function scan(ctx, image, l, w, eps, minPts){

	var offsetmap = createIndexMap(eps);

	var device_image = ctx.createBuffer(WebCL.CL_MEM_READ_ONLY, l * w * 4);
	var device_nodecount = ctx.createBuffer(WebCL.CL_MEM_READ_ONLY, l * w * 4);
	var device_xoffset = ctx.createBuffer(WebCL.CL_MEM_READ_ONLY, offsetmap.xoffset.length * 4);
	var device_yoffset = ctx.createBuffer(WebCL.CL_MEM_READ_ONLY, offsetmap.xoffset.length * 4);
	var uintimage = new Uint32Array(l * w);
	var nodecount = new Uint32Array(l * w);
	var xoffset = new Float32Array(offsetmap.xoffset.length);
	var yoffset = new Float32Array(offsetmap.xoffset.length);

	for(var i = 0; i < offsetmap.xoffset.length; i++){
		xoffset[i] = offsetmap.xoffset[i];
		yoffset[i] = offsetmap.yoffset[i];}



	for(var i = 0; i < l; i = i + 1){
		for(var j = 0; j < w; j = j + 1){
			uintimage[i * w + j] = image[i][j];}}




	var kernelSrc = loadKernel("Scan");
	var program = ctx.createProgramWithSource(kernelSrc);
	var devices = ctx.getContextInfo(WebCL.CL_CONTEXT_DEVICES);
	try {
					program.buildProgram ([devices[0]], "");
				  } catch(e) {
					alert ("Failed to build WebCL program. Error "
						   + program.getProgramBuildInfo (devices[0], WebCL.CL_PROGRAM_BUILD_STATUS)
						   + ":  " + program.getProgramBuildInfo (devices[0], WebCL.CL_PROGRAM_BUILD_LOG));
					throw e;
				  }
	var kernel = program.createKernel ("Scan");
	var nodecount = Uint32Array(l * w);

	kernel.setKernelArg (0, device_image);
	kernel.setKernelArg (1, device_nodecount);
	kernel.setKernelArg (2, device_xoffset);
	kernel.setKernelArg (3, device_yoffset);
	kernel.setKernelArg (4, l, WebCL.types.UINT);
	kernel.setKernelArg (5, w, WebCL.types.UINT);
	kernel.setKernelArg(6, offsetmap.xoffset.length, WebCL.types.UINT);

	var cmdQueue = ctx.createCommandQueue (devices[0], 0);
	cmdQueue.enqueueWriteBuffer (device_image, false, 0, l * w * 4, uintimage, []);
	cmdQueue.enqueueWriteBuffer (device_nodecount, false, 0, l * w * 4, nodecount, []);
	cmdQueue.enqueueWriteBuffer (device_xoffset, false, 0, offsetmap.xoffset.length * 4, xoffset, []);
	cmdQueue.enqueueWriteBuffer (device_yoffset, false, 0, offsetmap.xoffset.length * 4, yoffset, []);
	var localWS = [30];
	var globalWS = [Math.ceil (l * w / localWS) * localWS];
	cmdQueue.enqueueNDRangeKernel(kernel, globalWS.length, [], globalWS, localWS, []);
	cmdQueue.enqueueReadBuffer (device_nodecount, true, 0, l * w * 4, nodecount, []);
	cmdQueue.finish();
	return nodecount;
 }

function DBScan(ctx, D, imageWidth, imageHeight, eps, minpts) {
var showdebug = document.getElementById('showdebug').checked;
startTime = new Date().getTime();
// All output is written to element by id "output"
var output = document.getElementById("output");
try {
	  // First check if the WebCL extension is installed at all
	  if (window.WebCL == undefined) {
		alert("Unfortunately your system does not support WebCL. " +
			  "Make sure that you have both the OpenCL driver " +
			  "and the WebCL browser extension installed.");
		return false;
	  }

	  var l = imageHeight;
	  var w = imageWidth;

	  var image = D;



	//  console.log("Starting scan");
	  var nodecount = scan(ctx, image, l, w, eps, minpts);
	  var roots = ReduceRoot(ctx, nodecount, image, l, w, eps, minpts);
	  //console.log(roots);
	  //var clusters = createClusterList(roots, nodecountnodecount, minpts, l, w);
	  var nodes = [];
		//console.log("IMAGE\t" + image.length + image);
		if(image.length > 0){	//this creates the node array to run the ccl function
			for(var j = 0; j < image[0].length; j++){
				for(var i = 0; i < image.length; i++){
					nodes.push(image[i][j]);
				}
			}
		}
		//console.log(nodes);
		//console.log(nodecount);
		//	console.log("ENTERING CCL");
	  var clusters = ccl(roots, nodecount, minpts, l, w, eps, nodes);
	  //console.log(clusters);
	} catch(e) {
	  document.getElementById("output").innerHTML += "<h3>ERROR:</h3><pre style=\"color:red;\">" + e.message + "</pre>";
	  throw e;
	}
	//console.log("Finished");
	endTime = new Date().getTime();
	//console.log("Time elapsed (in milliseconds): " + (endTime - startTime));
	return clusters;
}

//auxillary structure for prototype createClusterList
//used to store data for sorting purposes inside of ccl function
function nodeTag(Root, Index){
	this.root = Root;
	this.index = Index;
}

//Sort tags by root
//sort  function implemented by ccl
function sortTags(arr){
	arr.sort(function(a,b) { return parseInt(a.root) - parseInt(b.root) } );
}

//prototype function for new createClusterList function
//rootsOld- roots of each pixel with each pixel addressed in row-major fashion
//nodecountOld- number of epsilon neighbors each pixel has, pixels are addressed row-major
//minpts- minimum points for dbscan
//		l - the length of the global image
//		w - the width of the global image
//epsilon- epsilon for dbscan
//nodes- a boolean representation of the global image, valid pixels are true, invalid are false, pixels are accessed COLUMN-MAJOR
function ccl(rootsOld, nodecountOld, minpts, l, w, epsilon, nodes){
	var nodecount = new Uint32Array(l * w);
	var roots = new Uint32Array(l * w);

	//row to column major translation
	for(var k = 0; k < nodecountOld.length; k++){
		var index = ((k % w) * l) + Math.floor(k / w);
		nodecount[index] = nodecountOld[k];
		roots[index] = rootsOld[k];
	}
	
	var offsets = createIndexMap(epsilon);

	//step one, create tag list
	var tagList = [];
	for(var i = 0; i < roots.length; i++){
			var k = new nodeTag(roots[i], i);
			tagList.push(k);
	}

	//step two, sort tag list by roots
	sortTags(tagList);
	
	//step three, insert list into cluster array structure
	var clusterList = [];
	var clusterRootList = [];
	var height = l;
	var width = w;
	for(var i = 0; i < tagList.length; i++){
		var myIndex = tagList[i].index;
		var myRoot = tagList[i].root;
		var myX = Math.floor(myIndex / height);
		var myY = myIndex % height;
		
		var nodeType = 'e';	//e -> empty node (default case)

		if(nodes[myIndex]){//if this is a valid node
			nodeType = 'n';		//n -> valid node but noise (default case if valid pixel)
			if((nodecount[myIndex] < minPts)){	//if this is not a core node
				//for each epsilon neighbor
				for(var j = 0; j < offsets.xoffset.length; j++){
					var neighborX = myX + offsets.xoffset[j];	//get neighbor coordinates
					var neighborY = myY + offsets.yoffset[j];
					
					if(neighborX >= 0 && neighborX < w && neighborY >= 0 && neighborY < l){	//if the neighbor's position is in bounds
						var neighborIndex = (neighborX * l) + neighborY;	//get neighbor Index

						if(nodecount[neighborIndex] >= minpts){	//if any given epsilon neighbor is a core node
							nodeType = 'b'			//b -> border node (has epsilon neighbor that is core node)
							j = offsets.xoffset.length;	//breaks out of loop
						}
					}
				}
			}else{		//enough neighbors for this to be a core node
				nodeType = 'c';	//c-> sufficient neighbors, core node
			}
		}
		
		var myNode = new node(myX, myY, myRoot, nodeType);
		
		if(nodeType == 'c' || nodeType == 'b'){	//if this is a core or a border node then it belongs to  a tree
			if(clusterList.length > 0){	//if this isn't the first entry into the cluster list
				if(tagList[i].root === tagList[i - 1].root){	//if this node has the same root as the last cluster
					clusterList[clusterList.length - 1].push(myNode);				
				}else{							//if this node does not have the same root as the last
					var tmpArr = [];
					clusterList.push(tmpArr);
					clusterList[clusterList.length - 1].push(myNode);	
					clusterRootList.push(myNode.root);	
				}
			}else{
				var tmpArr = [];
				clusterList.push(tmpArr);
				clusterList[clusterList.length - 1].push(myNode);	
				clusterRootList.push(myNode.r);
			}
		}
	}
	return clusterList;
}

//converts the cluster list returned from the local DBScan to global coordinate scheme
//localClusterList - a local processed partition to be converted to the global coordinate scheme
//localWidth - the width of the local partition image
//localHeight - the height of the local partition image
//globalWidth - the width of the entire image
//globalHeight - the height of the entire image
//xoffset - the x position in the global image at which the local partition starts
//yoffset - the y position in the global image at which the local partition starts
function convertClustersToGlobal(localClusterList, localWidth, localHeight, globalWidth, globalHeight, xoffset, yoffset){
	for( var i = 0; i < localClusterList.length; i++){
		for( var j = 0; j < localClusterList[i].length; j++){
			localClusterList[i][j].x += xoffset;
			localClusterList[i][j].y += yoffset;
			var root = localClusterList[i][j].r;
			var xroot = root % localWidth;
			var yroot = Math.floor(root / localWidth);
			xroot += xoffset;
			yroot += yoffset;
			root = (yroot * globalWidth) + xroot;
			localClusterList[i][j].r = root;
		}
	}
}

//function creates and returns and empty and appropriately sized global image structure
//globalImage - the object to work with
//globalWidth - the width that the final global image should be
//slobalHeight - the height that the final global image should be
function createGlobalLists(globalImage, globalWidth, globalHeight){
	for(var i = 0; i < globalHeight; i++){
		var k = [];
		globalImage.push(k);
		for(var j = 0; j < globalWidth; j++){
			var subk = [];
			globalImage[i].push(subk);
		}
	}
}

//function for merging a partition to the global image
//localClusterList - a locally processed partition
//globalClusterList - the global image to merge the local partition with
//localWidth - the width of the local partition image
//localHeight - the height of the local partition image
//globalWidth - the width of the global image
//globalHeight - the height of the global image
//xoff - the x position which the local partition starts at
//yoff - the y position which the local partition starts at
function mergeToGlobal(localClusterList, globalClusterList, localWidth, localHeight, globalWidth, globalHeight, xoff, yoff){

	convertClustersToGlobal(localClusterList, localWidth, localHeight, globalWidth, globalHeight, xoff, yoff);	//sets clusterList properties to global properties rather than local

	var globalImage = [];
	createGlobalLists(globalImage, globalWidth, globalHeight);			//creates a two dimensional array the same size as the input image, any given entry is a list of pixels from across the different partitions

	for(var i = 0; i < globalClusterList.length; i++){								//add the previous globalImage to the current globalImage
		for( var j = 0; j < globalClusterList[i].length; j++){
			globalImage[i][j] = globalClusterList[i][j];
		}
	}

	for(var c = 0; c < localClusterList.length; c++){							//add the local partition's clusters to the globalImage
		for(var n = 0; n < localClusterList[c].length; n++){
			var tmpx = localClusterList[c][n].x;
			var tmpy = localClusterList[c][n].y;
			globalImage[tmpy][tmpx].push(localClusterList[c][n]);
		}
	}

	for(var gh = 0; gh < globalImage.length; gh++){							//brute force root determination (could be more optimized, but short on time)
		for(var gw = 0; gw < globalImage[gh].length; gw++){
			if(globalImage[gh][gw].length === 2){
				if(globalImage[gh][gw][0].b === 'b' || globalImage[gh][gw][1].b === 'c'){					//if it is the case that the two clusters cause a conflict, and either of the nodes is core
					globalImage[gh][gw][0].b = globalImage[gh][gw][1].b = 'c'
					var a = Math.min(globalImage[gh][gw][0].r, globalImage[gh][gw][1].r);		//find all instances of the higher root, and replace them with the lower root
					var b = Math.max(globalImage[gh][gw][0].r, globalImage[gh][gw][1].r);
					for(var listh = 0; listh < globalImage.length; listh++){
						for(var listw = 0; listw < globalImage[listh].length; listw++){
							for(var l = 0; l < globalImage[listh][listw].length; l++){
								if(globalImage[listh][listw][l].r === b){
									globalImage[listh][listw][l].r = a;
								}
							}
						}
					}
				}
			}else if(globalImage[gh][gw].length > 2){
				console.log("Error, more than 2-entries at globalIndex.  You have " + globalImage[gh][gw].length + " entries at index: [" + gh + "][" + gw + "]");
			}
		}
	}

	for(var gh = 0; gh < globalImage.length; gh++){								//remove the redundent entries in the globalImage
		for(var gw = 0; gw < globalImage[gh].length; gw++){
			while(globalImage[gh][gw].length > 1){
				globalImage[gh][gw].splice(globalImage[gh][gw].length - 1, 1);
			}
		}
	}

	//globalClusterList = globalImage;														//assign the globalImage to the globalClusterList
	return globalImage;
}