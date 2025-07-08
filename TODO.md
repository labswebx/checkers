### Android
- [ ] On the chat screen, the keyboard hides the text field to type the message
- [ ] Socket not working
- [ ] Improve the overall design

### Backend / Frontend
- [ ] Create a deploy.sh file so that whenever we deploy on server, we just have to run that file. It will install the packages, close running PORTS from NGINX, run mongod & run the server. Basically it will be the one file to run for deployment, no need to install packages & all
- [ ] Setup automatic env detection on Frontend so that we don't have to change the URL everytime we deploy
- [ ] Show proper error message in case of Login & register. Try register with duplicate email or try login with agent email.
- [ ] For every franchise it is creating a new user. Verify why & how is this happening & whats the need for this.

- [ ] Remove auth from scraping APIs
- [ ] Backend code is not properly modularised. All the logic is in routes or controllers.
- [ ] Remove all loggers
- [ ] Prod is taking a lot of storage, fix it



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