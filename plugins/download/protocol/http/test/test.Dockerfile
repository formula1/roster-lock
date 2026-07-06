FROM nginx:alpine

RUN mkdir -p /usr/share/nginx/html/subdir

RUN printf 'Hello, World!\n'         > /usr/share/nginx/html/sample.txt
RUN printf 'Integration test data\n' > /usr/share/nginx/html/subdir/data.txt

RUN cd /usr/share/nginx/html \
 && tar cf archive.tar sample.txt subdir/ \
 && tar czf archive.tar.gz sample.txt subdir/
