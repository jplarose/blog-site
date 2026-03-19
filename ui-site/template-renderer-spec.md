# Goal
This site will need to render the users home page and then have a side bar to the left with the users categories. Viewing the users post will need to call the dotnet API to retrieve the post content as well as the post template to render the pages effectively. For this site, the posts will end up being relatively static once created, so we will want to utilize aggressive caching to make sure that it loads very very quickly. To counter this in the event that we need to propogate changes though we will also want a rock solid cache invalidation mechanism. Outside of that, this will likely not be very complicated.

Home page /
--> Categories /{categoryName}
    --> Posts /{categoryName}/{post-slug}

## Things this site will not include
- Interactive comments section
- Ads
- Contact/About Me page
- Auth or sign in
- User Accounts
