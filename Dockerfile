FROM node:slim

WORKDIR /

RUN apt-get update \
    && apt-get upgrade --assume-yes --quiet=2 \
    && apt-get install --assume-yes --no-install-recommends --no-show-upgraded wget unzip \
    && wget --quiet --show-progress --progress=bar:force http://blzdistsc2-a.akamaihd.net/Linux/SC2.4.10.zip \
    && unzip -q -P iagreetotheeula SC2.4.10.zip \
    && rm SC2.4.10.zip \
    && apt remove --yes wget unzip \ 
    && apt autoremove --yes \
    && ln -s /StarCraftII/Maps /StarCraftII/maps \
    && rm -rf /StarCraftII/maps/* \
    && rm -rf /StarCraftII/Battle.net/* \
    && rm -rf /StarCraftII/Versions/Shaders*

COPY games/maps /StarCraftII/Maps

WORKDIR /app

COPY games/package.json ./package.json
COPY games/go.js ./go.js

RUN npm install

ENTRYPOINT ["node", "go.js"]
