
FROM node:18-alpine

WORKDIR /usr/src/app
#Specify a working directory
WORKDIR /usr/app
#Copy the dependencies file
COPY ./package.json ./
#Install dependencies
RUN npm install 
#Copy remaining files
COPY ./ ./

COPY wait-for-it.sh /wait-for-it.sh
RUN chmod +x /wait-for-it.sh
CMD ["./wait-for-it.sh", "mysql:3306", "--", "npm", "start"]

#Default command
#CMD ["npm","start"]