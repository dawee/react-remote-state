FROM node:20.15

WORKDIR /usr/src/app

ARG port
ENV port=${port}

COPY package.json ./
COPY bin/rrs-server ./
RUN chmod +x ./rrs-server

RUN npm install
EXPOSE ${port}

ENTRYPOINT /usr/src/app/rrs-server --port=$port


