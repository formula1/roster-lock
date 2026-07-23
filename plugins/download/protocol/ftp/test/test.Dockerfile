FROM alpine:3.21

RUN apk add --no-cache vsftpd openssl

# Self-signed cert for explicit FTPS (AUTH TLS)
RUN openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/ssl/vsftpd.key \
    -out    /etc/ssl/vsftpd.crt \
    -subj   "/CN=localhost"

# Fixture files
RUN mkdir -p /srv/ftp/subdir /srv/ftp/files/subdir
RUN printf 'Hello, World!\n'         > /srv/ftp/sample.txt
RUN printf 'Integration test data\n' > /srv/ftp/subdir/data.txt
RUN cd /srv/ftp \
 && tar cf archive.tar sample.txt subdir/ \
 && tar czf archive.tar.gz sample.txt subdir/

# /files/ mirrors the fixture structure for directory-download tests
RUN cp /srv/ftp/sample.txt        /srv/ftp/files/sample.txt
RUN cp /srv/ftp/subdir/data.txt   /srv/ftp/files/subdir/data.txt

RUN printf '\
listen=YES\n\
listen_ipv6=NO\n\
anonymous_enable=YES\n\
local_enable=NO\n\
write_enable=NO\n\
anon_root=/srv/ftp\n\
pasv_enable=YES\n\
pasv_min_port=21000\n\
pasv_max_port=21010\n\
pasv_address=127.0.0.1\n\
ssl_enable=YES\n\
ssl_tlsv1=YES\n\
ssl_sslv2=NO\n\
ssl_sslv3=NO\n\
rsa_cert_file=/etc/ssl/vsftpd.crt\n\
rsa_private_key_file=/etc/ssl/vsftpd.key\n\
force_local_data_ssl=NO\n\
force_local_logins_ssl=NO\n\
require_ssl_reuse=NO\n\
seccomp_sandbox=NO\n\
' > /etc/vsftpd/vsftpd.conf

EXPOSE 21 21000-21010

CMD ["vsftpd", "/etc/vsftpd/vsftpd.conf"]
