FROM node:22-alpine

RUN apk add --no-cache git

# Create a bare repo pre-populated with the fixture files
RUN git config --global user.email "test@test.local" \
 && git config --global user.name "Test"

RUN git init --bare /repo

RUN git clone /repo /tmp/work \
 && cd /tmp/work \
 && mkdir -p subdir \
 && printf 'Hello, World!\n'         > sample.txt \
 && printf 'Integration test data\n' > subdir/data.txt \
 && git add . \
 && git commit -m "fixtures" \
 && git push origin HEAD:main \
 && rm -rf /tmp/work \
 # git init --bare defaults HEAD to refs/heads/master, which never receives
 # a commit here (everything is pushed to main) — leaving HEAD unresolvable
 # and breaking ref advertisement for clients that need to dereference it.
 && git -C /repo symbolic-ref HEAD refs/heads/main

COPY server.js /server.js

EXPOSE 3000

CMD ["node", "/server.js"]
