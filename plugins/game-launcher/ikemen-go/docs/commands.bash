

INIT_PWD="$(pwd)"
DIR=/home/sam/Games/Ikemen-GO-1.0.0-rc.2
CHAR="./chars/kfm/kfm.def"
PORT=12345
R=2

startBasic() {
  echo "$INIT_PWD/abc123.txt"
  cd $DIR || exit
  echo "$INIT_PWD/abc123.txt"
  ./Ikemen_GO_Linux -p1 $CHAR -p1.color 1 -p2 $CHAR -p2.color 3 -log "$INIT_PWD/abc123.txt" -rounds $R
}


startHost(){
  cd $DIR || exit
  ./Ikemen_GO_Linux -rounds $R -p1 $CHAR -p1.color 1 -p2 $CHAR -p2.color 3 -log "$INIT_PWD/abc123-host.txt" -setport $PORT -ip ""
}

startClient(){
  cd $DIR || exit
  ./Ikemen_GO_Linux -rounds $R -p1 $CHAR -p1.color 1 -p2 $CHAR -p2.color 3 -log "$INIT_PWD/abc123-client.txt" -setport $PORT -ip "127.0.0.1"
}

if [[ "$1" == "host" ]]; then
  startHost
elif [[ "$1" == "client" ]]; then
  startClient
else
  startBasic
fi

