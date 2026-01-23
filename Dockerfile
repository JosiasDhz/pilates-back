FROM node:20.19.1
WORKDIR /opt/data/app
COPY . /opt/data/app
RUN yarn install
RUN yarn build
EXPOSE 3000
CMD ["yarn", "run", "start:prod"]
