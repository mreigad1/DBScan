/*
inputs:
image = 1darray holding 1s and 0s of a binary image
int* nodecount = 1darray holding number of neighbors each pixel has
xoffset = 1darray holding list of x locations each thread should look at.  Same for every thread.  Paired with yoffset
yoffset = 1darray holding list of y locations each thread should look at
w = width of image
l = length of image
offsetsize = length of xoffset and yoffset

process:
Uses xoffset and yoffset to check around a pixel and determine the number of 1s found in it's region

output:
nodecount will return the number of neighbors found in each pixel
*/
__kernel void Scan(__global unsigned int* image, __global unsigned int* nodecount, __global float* xoffset, __global float* yoffset, unsigned int l, unsigned int w, unsigned int offsetsize) {
    unsigned int gtid = get_global_id(0);
    if (gtid < l * w) {
        nodecount[gtid] = 0;
        int x = gtid % w;
        int y = gtid / w;
        for(int i = 0; i < offsetsize; i++) {
            int tempx = x + xoffset[i];
            int tempy = y + yoffset[i];
            if(tempx >= 0 && tempx < w && tempy >=0 && tempy < l) {
                if(image[tempy * w + tempx] == 1) {
                    nodecount[gtid] = nodecount[gtid] + 1;
                }
            }
        }
    }
}

