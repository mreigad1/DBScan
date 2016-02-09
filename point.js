/**
 * Point constructor.
 * @author Benjamin Kruger, bekroogle@gmail.com
 * 
 */

function Point(x,y) {
	this.x = x;
	this.y = y;
	this.clusterID = undefined;
	this.visited = false;
	this.distFrom = function (i) {
		return Math.abs(i.y - this.y) + Math.abs(i.x - this.x);
	}
}
