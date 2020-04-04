
FROM node:10

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY . .

# If you are building your code for production
RUN yarn install

# Bundle app source

EXPOSE 8001
CMD [ "node", "index.js" ]