FROM ipfs/kubo:latest

COPY start_ipfs_test.sh /usr/local/bin/start_ipfs_test.sh
RUN chmod +x /usr/local/bin/start_ipfs_test.sh

ENTRYPOINT ["/usr/local/bin/start_ipfs_test.sh"]
