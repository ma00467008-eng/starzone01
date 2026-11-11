# Starzone01

Project: STAR ZONE — Free-to-Play Gaming Platform
Build a complete, professional, fully functional, mobile-first gaming website named STAR ZONE.
1. MAIN REQUIREMENTS
The platform should be visually inspired by Popzar and similar professional gaming platforms.
Design requirements:
Premium sky-blue and white theme.
Realistic gaming platform appearance.
Professional typography and spacing.
Smooth animations and transitions.
High-quality game logos and graphics.
Responsive Android, iPhone, tablet and desktop layouts.
Professional bottom navigation.
No childish, cartoonish or unfinished interfaces.
Complete frontend, backend, database and Super Admin Panel.
IMPORTANT: This is a free-to-play entertainment platform. All stakes, balances, payouts, winnings and losses must use non-redeemable virtual coins. No real-money deposits, withdrawals or cash prizes.
Every feature must actually work. Do not create static demonstration buttons.
2. LOGIN AND SIGNUP SYSTEM
Registration
Required fields:
Phone Number
Password
Confirm Password
After entering the information, display an interactive picture-puzzle CAPTCHA.
The user must slide a missing puzzle piece into its correct position.
Once completed successfully, register the account automatically.
No additional phone OTP or email verification is required.
The CAPTCHA must be validated securely by the backend, not just visually.
Login
Fields:
Phone Number
Password
Same sliding picture-puzzle verification.
Include:
Secure sessions.
Password hashing.
Logout.
Duplicate account prevention.
Login attempt protection.
Password recovery through a secure recovery process.
Automatic unique UID generation.
Each newly registered account receives a random username and default avatar.
3. WEBSITE NAVIGATION
Create four main sections using a fixed mobile bottom navigation bar.
Section
Icon
Home
Home
PROMO
Gift
Chat
Message
Account
Profile
The currently selected section must be visually highlighted.
Navigation should be fast and smooth without unnecessary page reloads.
4. HOME SECTION
Design the homepage to resemble a premium gaming platform.
Top Header
Display:
STAR ZONE logo.
User's current virtual coin balance on the top-right.
Notification icon.
Quick coin-addition button.
Advertisement Slider
Create a large rectangular promotional image carousel.
Requirements:
Supports 4–5 images or more.
Automatically slides.
Users can manually swipe forward and backward.
Previous/next navigation.
Pagination indicators.
Smooth animation.
Optional clickable promotional links.
Fully controlled through the Admin Panel.
Admin must be able to upload, delete, replace, reorder, enable and disable images.
Game Lobby
Display every available game using professional game cards containing:
Original-quality game logo or appropriately licensed artwork.
Game name.
Attractive rectangular thumbnail.
Play button.
Optional NEW or HOT indicator.
Games should open directly into their dedicated full-screen or responsive gaming interfaces.
Also include:
Announcements.
Featured games.
Recently played games.
Popular games.
Virtual coin balance.
Promotional banners.
Support shortcuts.
Telegram and WhatsApp community links.
All content must be manageable by Admin.
5. COMPLETE GAME SYSTEM
Create 10 playable games.
These games must have functional mechanics, not just decorative interfaces.
Games
WinGo
TRX WinGo
Chicken Road 2
Aviator-style Crash Game
Mines
Plinko
Dice
Limbo
Dragon Tiger
Color Prediction
Use original or properly licensed implementations and assets. Aim for the same professional gameplay quality and familiar mechanics as established gaming platforms without copying proprietary source code or branding.
Common Game Requirements
Every game must include:
Complete playing interface.
Virtual coin stake selection.
Functional gameplay.
Win and loss calculation.
Virtual coin payouts.
Result animations.
Round ID.
Game history.
User statistics.
Clear game rules.
Server-side outcome validation.
Transaction history.
Proper balance synchronization.
The user must never be able to modify their balance through frontend manipulation.
WinGo
Include:
30-second mode.
1-minute mode.
3-minute mode.
5-minute mode.
Live countdown.
Big/Small selection.
Color selection.
Number selection.
Virtual stake options.
Previous results.
Result history.
Trend charts.
Win/loss settlement.
TRX WinGo
Create a separate TRX-themed WinGo game with its own rounds, history and results.
It must remain entirely virtual and must not require actual cryptocurrency transfers.
Chicken Road 2
Create a polished chicken-crossing risk/reward game.
Include progressive virtual multipliers, hazard positions, animated movement, stake selection, cash-out mechanics and win/loss settlement.
Aviator-Style Game
Create a professional crash-multiplier game with:
Animated flight interface.
Increasing multiplier.
Virtual stake placement.
Manual cash-out.
Optional automatic virtual cash-out.
Round history.
Crash results.
Clear win/loss display.
Complete the remaining games with their appropriate mechanics and professional interfaces.
Game outcomes must be generated and validated securely on the backend. Display clear rules and outcome probabilities. Admin must not be able to secretly manipulate individual players' results.
6. PROMOTIONAL POP-UP SYSTEM
Whenever a user logs in or registers, display promotional picture pop-ups.
Admin can upload any number of promotional pictures.
For example, if four pictures are enabled:
Display promotion 1.
When the user closes it, display promotion 2.
Then promotion 3.
Finally promotion 4.
Each pop-up must include:
Promotional image.
Close button.
Don't Remind Again checkbox.
Optional clickable promotional link.
If the user selects Don't Remind Again, stop displaying the remaining promotions for that login session.
Promotions may appear again after the user logs out and logs back in.
Admin can manage promotion order, images, links and visibility.
7. PROMO SECTION
Create a dedicated PROMO page.
Display promotional rectangular pictures vertically.
Each picture should have:
Professional spacing.
Rounded corners.
High-resolution display.
Optional clickable link.
Admin must be able to add unlimited promotional images, change their order and remove them.
8. CHAT SECTION
This is a private user-to-admin messaging system, not a public group chat.
Every registered user can communicate directly with Admin.
Features:
Text messages.
Image attachments.
Message timestamps.
Unread message indicators.
Image preview.
Conversation history.
Smooth chat interface.
Real-time messaging.
New message notifications.
Admin Panel must have a centralized inbox showing all user conversations.
Admin can search users by UID, username or phone number and reply individually.
Users must only be able to access their own conversations.
9. ACCOUNT SECTION
Design the Account page in the style of a professional gaming platform.
Profile Header
Display:
User avatar.
Randomly generated username.
Unique UID.
Virtual coin balance.
Profile editing option.
UID must be unique and permanent.
Add Coins
Create a dedicated Add Coins feature.
This is NOT a deposit or payment system.
When the user clicks Add Coins:
Open a new page.
Allow selection of an amount between 300 and 10,000 virtual coins.
Display instructions written by Admin.
Display an instructional screenshot uploaded by Admin.
Allow the user to submit a virtual coin request.
Send the request to the Admin Panel.
Admin can approve or reject the request.
Approved requests automatically credit the user's virtual balance.
Rejected requests do not change the balance.
Show request status:
Pending
Approved
Rejected
Admin can edit the instructions, instructional image, available coin amounts and request limits.
No payment proof or real-money transfer is required.
Additional Account Options
Create the following sections:
Notification
Display announcements, game notifications, coin request updates, gift notifications and administrative messages.
Game History
Show all previously played games with:
Game name.
Round ID.
Date and time.
Virtual stake.
Result.
Win/loss amount.
Game Statistics
Display total games played, total virtual winnings, total virtual losses, win rate and game-specific performance.
Account and Security
Allow users to:
Change password.
Update avatar.
Edit username.
View UID.
Manage account security.
Log out.
Live Support
Create a self-service FAQ system.
Admin can add questions and answers through the Admin Panel.
When a user clicks a question, its answer expands.
If the answer is not helpful, provide a Create Ticket option.
Tickets must support:
Subject.
Description.
Optional image.
Pending/open/closed status.
Admin replies.
Gift
Create a gift-code redemption system.
Users can enter a code and redeem virtual coins or other non-monetary rewards.
Admin can create codes and configure:
Reward amount.
Usage limit.
Expiry date.
One redemption per user.
Active/inactive status.
Public/private visibility.
Admin can optionally display available gift codes to users.
Language
Support:
English.
Urdu.
Translate the entire user interface, including game instructions, notifications, settings and error messages.
Settings
Include:
Sound on/off.
Notifications.
Language preferences.
Animation preferences.
Privacy information.
Terms and conditions.
Logout.
10. TELEGRAM AND WHATSAPP INTEGRATION
Include support and community buttons for:
WhatsApp Support.
Telegram Support.
WhatsApp Channel.
Telegram Channel.
Admin must be able to add and update all links later.
If a link is not configured, its corresponding button should remain hidden.
Use the appropriate platform icons.
11. COMPLETE SUPER ADMIN PANEL
Build a separate, secure, fully functional Admin Panel.
Initial Admin Credentials
Admin Login Identifier: 03705723114
Initial Password: admin@1122
These are initial setup credentials only. Store the password securely as a hash, never expose it in frontend code, and require a password change at first login.
Admin Dashboard
Show:
Total registered users.
Active users.
New registrations.
Total virtual coins in circulation.
Pending coin requests.
Total games played.
Game activity.
Pending support tickets.
Unread messages.
Recent activity.
Admin Modules
1. User Management
Admin can search, view, suspend, reactivate and manage users.
View UID, username, phone, registration date, balance, game history and account status.
2. Virtual Coin Management
Admin can:
View pending requests.
Approve requests.
Reject requests.
Credit virtual coins.
Deduct virtual coins with a recorded reason.
View transaction history.
Set request limits.
Prevent duplicate approval or accidental double-crediting.
3. Game Management
Manage:
Game availability.
Virtual stake limits.
Game rules.
Published payout tables.
Game announcements.
Maintenance status.
Game artwork.
All game outcomes must follow their published rules.
4. Advertisement Management
Upload homepage banners and promotional pictures.
Control image order, links, visibility and scheduling.
5. Pop-up Management
Manage login promotional pop-ups independently.
6. PROMO Page Management
Upload, remove and reorder promotional images.
7. Chat Management
View and reply to private user conversations, including image attachments.
8. Support Management
Create and edit FAQ questions and answers.
View, assign, reply to and close support tickets.
9. Gift Code Management
Create, modify, activate, deactivate and monitor gift codes.
10. Notifications
Send announcements to:
All users.
Selected users.
Individual UID.
11. Social Link Management
Edit WhatsApp and Telegram support and channel links.
12. Website Settings
Manage website name, logo, favicon, colors, footer, maintenance mode, registration availability and general settings.
12. EVERY SINGLE TEXT MUST BE EDITABLE
This requirement is extremely important.
Create a centralized Content Management System inside the Admin Panel.
Admin must be able to edit every user-facing text without changing website code.
This includes:
Headings.
Button labels.
Descriptions.
Instructions.
Announcements.
Promotional text.
FAQ answers.
Error messages.
Game descriptions.
Coin request instructions.
Footer.
Terms and conditions.
Support messages.
English and Urdu translations.
Include a text search feature so Admin can quickly find and edit specific content.
Provide Save, Preview and Restore Default options.
The Admin Panel itself must also support configurable labels where practical.
13. DATABASE AND BACKEND
Use a real persistent database.
Create appropriate database structures for:
Users.
Admins.
User profiles.
Virtual wallets.
Wallet transactions.
Coin requests.
Games.
Game rounds.
Game results.
Game statistics.
Chat conversations.
Chat messages.
Notifications.
Advertisements.
Promotional pop-ups.
Support tickets.
FAQ entries.
Gift codes.
Gift redemptions.
Website settings.
Translations.
Admin activity logs.
Use secure authentication, role-based access control, protected file uploads, transaction-safe balance updates and proper server-side validation.
Never expose admin credentials, secrets or privileged operations in client-side code.
14. VISUAL DESIGN
Use Popzar as a visual inspiration while giving STAR ZONE its own identity.
Color Palette
Element
Color
Primary
Sky Blue #38BDF8
Secondary
Deep Blue #0284C7
Background
#F4FAFF
Cards
White
Primary Text
#172B4D
Success
#16A34A
Error
#EF4444
The website should feel like a polished, established gaming platform.
Use:
Premium gaming graphics.
Professional game cards.
Subtle shadows.
Smooth page transitions.
Clean balance displays.
Responsive pop-ups.
Loading animations.
Toast notifications.
Confirmation dialogs.
Proper empty states.
Skeleton loaders.
High-quality icons.
Avoid cartoon styling, oversized childish buttons, random colors and generic unfinished layouts.
15. FINAL DEVELOPMENT REQUIREMENTS
Build this as a COMPLETE FULL-STACK APPLICATION.
Do not deliver only a static landing page or frontend mockup.
All navigation, registration, authentication, CAPTCHA, games, virtual coin balances, requests, notifications, chats, support tickets, gift codes, advertisements and admin controls must work.
Implement proper database persistence so data remains saved after refreshing or reopening the website.
Make the entire platform mobile-first and installable as a Progressive Web App (PWA).
Include clear loading, success and error states throughout the application.
Test all user and administrator workflows.
Final objective: Deliver STAR ZONE as a complete, smooth, realistic, sky-blue, free-to-play gaming platform with 10 functional games, comprehensive user features and a powerful Super Admin Panel.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://starzone01.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/48460584-bf52-402c-96b9-3679be4dc306).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
