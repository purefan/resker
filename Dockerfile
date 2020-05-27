
FROM node:12

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY . .

# node is built on debian stretch without logrotate
RUN apt-get update && apt-get install logrotate forever -y
COPY ./assets/resker /etc/logrotate.d/resker
RUN chmod 644 /etc/logrotate.d/resker

RUN mkdir -p /usr/src/app/assets/logs/
RUN touch /usr/src/app/assets/logs/resker.log

RUN yarn install

# Bundle app source
EXPOSE 8001
CMD [ "npm", "start" ]