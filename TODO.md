### Android
- [ ] On the chat screen, the keyboard hides the text field to type the message
- [ ] Socket not working
- [ ] Improve the overall design
- [ ] Create the scheduler for sending the SMS

### Backend / Frontend
- [ ] In the perPage component in the Pagination, backend gives BSONObjectTooLarge error if pagination is set to 50 or more, fix this.
- [ ] Create a deploy.sh file so that whenever we deploy on server, we just have to run that file. It will install the packages, close running PORTS from NGINX, run mongod & run the server. Basically it will be the one file to run for deployment, no need to install packages & all
- [ ] Setup automatic env detection on Frontend so that we don't have to change the URL everytime we deploy
- [ ] Show proper error message in case of Login & register. Try register with duplicate email or try login with agent email.

- [ ] Remove auth from scraping APIs
- [ ] Backend code is not properly modularised. All the logic is in routes or controllers.
- [ ] In the network-interceptor.js file, for rejected & approved deposits & withdraws - The response has a lot of items & hence it takes time to process them all. FIrst response is in progress and then we get another response, and hence because of this the older response closes & the later transactions status is not updatyed



- [x] Not able handle error messages properly. Check by adding duplicate email while registering a user
- [x] Create a User listing page
- [x] Refresh redirects to the home page
- [x] Login should be only possible for admin roles
- [x] Main scraping logic
- [x] Scheduler to automatically scrape data every 20 seconds
- [x] Logic to scrape data from Recent deposits and update the data. If the transaction is pending for more than 2 minutes, then send a whatsapp mesage
- [x] Scheduler to automatically scrape the recent-deposits
- [x] ⁠UI to display the Transactions
- [x] Total Count on the bottom of page is wrong in deposits
- [x] Total Users count is wrong
- [x] ⁠Sending WhatsApp messages
- [x] Update user
- [x] Make home page analytics APIs
- [x] Add a page where we can show the performance of every franchise
- [x] We need to keep a track of the time when the status was updated, will be helpful in performance page.
- [x] Complete the withdrawal page as well. Keep it on a separate branch
- [x] For every franchise it is creating a new user. Verify why & how is this happening & whats the need for this.
- [x] Remove all loggers
- [x] Prod is taking a lot of storage, fix it
- [x] Add the option to give perPage on the UI
- [x] In deposits analysis, add the transactions completed <= 2 min.
- [x] On the pending withdraw page, the count is not correct in the timer slab. If any transaction takes more than 20 mins, it's not coming in the 20-30 min wala slab.
- [x] Keep a track of the users. Who all visited the website, if not this, atleast how many unique users visited the website. And their duration and the page they visited as well.