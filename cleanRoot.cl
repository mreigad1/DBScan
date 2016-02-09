__kernel void CleanRoot(__global unsigned int* roots,
                        __global unsigned int* image, unsigned int l,
                        unsigned int w) {
    unsigned int gtid = get_global_id(0);
    int t = 0;
    if(gtid < l * w)
        for(int i = 0; i < l * w; i++) {
            if(roots[i] == roots[gtid]) {
                t = t + 1;
            }
        }
    if(t <= 1) {
        roots[gtid] = (l * w) + 1;
    }
    if(image[gtid] == 0) {
        roots[gtid] = l * w + 2;
    }
}
