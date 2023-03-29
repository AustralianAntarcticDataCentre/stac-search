from node:lts

WORKDIR /app

COPY ./ .
RUN npm install
EXPOSE 4000
CMD ["node", "server.mjs"]
