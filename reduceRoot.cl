/*
inputs:
image = 1darray holding 1s and 0s of a binary image
int* roots= 1darray holding number of root of each pixel (think of root as a clusterID)
mincounts = 1darray holding the neighbor count of each pixel
xoffset = 1darray holding list of x locations each thread should look at.  Same for every thread.  Paired with yoffset
yoffset = 1darray holding list of y locations each thread should look at
w = width of image
l = length of image
minPts = minimum number of points needed to be a corenode
offsetsize = length of xoffset and yoffset

process:
Checks for a smaller root in it's region, and switches if the smaller root is a corenode.

output:
roots = run this program iteratively.  Roots will store the cluster ids of each thread.  Stop running when roots does not change.
*/

__kernel void ReduceRoot(__global unsigned int* image, __global unsigned int* roots, __global unsigned int* mincounts, __global float* xoffset,
                         __global float* yoffset, unsigned int l, unsigned int w, unsigned int eps, unsigned int minPts, unsigned int offsetsize) {
    unsigned int gtid = get_global_id(0);
    if(gtid < l * w) {
        if(roots[gtid] > l * w) {
            roots[gtid] = gtid;
        }
        int x = gtid % w;
        int y = gtid / w;
        if(image[y * w + x] == 1) {
            for(int i = 0; i < offsetsize; i++) {
                int tempx = x + xoffset[i];
                int tempy = y + yoffset[i];
                if(tempx >= 0 && tempx < w && tempy >=0 && tempy < l) {
                    if(image[tempy * w + tempx] == 1 && roots[tempy * w + tempx] < roots[gtid]) {
                        if(mincounts[tempy * w + tempx] >= minPts) {
                            roots[gtid] = roots[tempy * w + tempx];
                        }
                    }
					else if(image[tempy * w + tempx] == 1 && mincounts[gtid] < minPts){
						if(mincounts[tempy * w + tempx] >= minPts) {
							roots[gtid] = roots[tempy * w + tempx];
						}
					}
                }
            }
        }
    }
}