/**
 * The long editorial pages, as mermademarket.com writes them.
 *
 * These are their own rich-text blocks, lifted from the live pages and kept
 * as HTML because that is what they are: hand-written prose with their
 * emphasis, their headings and their links. Rewriting it into JSX would only
 * be an opportunity to change it by accident.
 *
 * Everything dated, counted or priced is a `{{token}}` filled from the Show
 * record at render time (CLAUDE.md rule 6), and every link to one of their
 * /pages/* URLs was rewritten to our route. Nothing else was edited.
 *
 * The HTML is ours to trust: it is checked into this repo, and it is rendered
 * with dangerouslySetInnerHTML by the pages in src/app/makers/.
 *
 * September 2026: the two maker-rules blocks used to be one string each, and
 * each rendered as roughly eight thousand pixels of unbroken body copy. The
 * words are unchanged. They are now cut into named sections, one per question
 * a maker actually arrives with, and the pages render them as the theme's own
 * accordion (docs/08-DESIGN-SYSTEM.md §8: use the shape the content is). The
 * only text that left the page is the bare list of space sizes, which the
 * price table above the accordion now carries with its prices; every fact in
 * it survives, in the section it belongs to.
 */

/** Values a page block can interpolate. */
export type PageVars = Record<string, string | number>

/** Fills the `{{token}}` placeholders. An unknown token is left visible so a
 *  missing value shows up in review rather than rendering as an empty gap. */
export function fill(html: string, vars: PageVars): string {
  return html.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}

/**
 * One named, collapsible section of a rules page.
 *
 * `id` is the fragment a link can point at (`/makers/indoor#labels`), `q` is
 * the summary line, and `html` is their prose with its tokens intact.
 */
export type PageSection = { id: string; q: string; html: string }

/**
 * /makers/indoor. Their inside-maker rules, in ten sections.
 *
 * Order follows the order a maker meets them: what the track is, when to
 * turn up, how to build the space, how to keep it stocked, how to label it,
 * then the four rules that only apply to some makers, then the housekeeping.
 */
export const indoorSections: PageSection[] = [
  {
    id: 'inside',
    q: 'What selling inside means',
    html: `<p>There are two parts to Mermade Market - inside makers and outside makers. Together, they make for a truly magical event! The building on the site is used for our “inside” shopping where {{indoorCapacity}} shops beautifully display their products for all  3 days, retail style, and they <em>don’t stay at their space</em> to sell. There simply isn’t room for that, plus, that’s not what it was created for. The inside portion of Mermade is a huge reason why we created Mermade in the first place! In fact, we didn’t add the outside area of the market until 4 years later. As handmade market customers ourselves, we loved the idea of being able to shop, pressure-free. We do, however, love a dynamic set of makers that are interacting and selling direct to customer. Makers that can sell well, play it cool, and actually thrive off customers who want to “meet the maker” are best for our outside market..so if you’re the type of person that wants to be there to sell, check out our <a href="/makers/outdoor">outside information</a> and see if one of those days would be better to sell. For those of you that want a relaxed way to enjoy the market as a maker, or perhaps you get nervous to sell, have a full-time day job, are busy with family life, etc… <em>we gotchyou</em>! There are multiple registers run by Mermade staff available at one, single exit point where customers check out. We carefully track each sale using unique IDs per maker &amp; pay {{payoutMin}} to {{payoutMax}} days after the market’s last day. If you sign up for this, it is required of you that 2 weeks prior to the event date, you send us your inventory list &amp; prices.</p><p>Custom product options and forms are not commonly filled out by our customers inside, so if you feel like you would need this to be successful in sales, outside is a better fit. You can have a sign at your shop space that says something like "We offer customization!" or supply a sign up sheet/mailing list to customers so they can learn more.</p>`,
  },
  {
    id: 'schedule',
    q: 'Set-up and take-down',
    html: `<dl class="fact-table"><div class="fact-table__row"><dt>Set-up</dt><dd>{{loadIn}}: time slot chosen in the application.</dd></div><div class="fact-table__row"><dt>Show hours</dt><dd>{{day1}}<br/>{{day2}}<br/>{{day3}}</dd></div><div class="fact-table__row"><dt>Take-down</dt><dd>{{takedown}}</dd></div></dl><p><em>Times will be staggered for set up to help us eliminate too many humans in one room, clogging exits &amp; entrances with dollies &amp; supplies. You will choose a 2 hour window but that’s really just to keep things flowing and not stagnant. Thank you for helping us with this!</em></p><p>If you show up past 6pm on Thursday, you will be charged $100. If you show up past 7pm, you will not be able to participate in the show. </p><p><em><strong>You cannot set up Friday am</strong></em><strong>. !!!!!</strong></p><p>Please to be punctual for both Set up &amp; Take down!</p><p>If you can’t be there to set up your shop space or cannot find someone to help you, then you cannot do the inside portion of the market. There is no other set up date or option besides {{loadIn}}.  Once the show starts Friday morning, it is GO TIME and there will be no time for any sort of set up. </p>`,
  },
  {
    id: 'display',
    q: 'How to display your space',
    html: `<p class="mk-inspo"><strong>Before you plan your space:</strong> <a href="/lookbook/indoor">see real indoor spaces from past shows</a>, and <a href="https://www.pinterest.com/mermademarket/space-inspiration/" target="_blank" rel="noopener">our Pinterest board of display ideas</a>.</p><p>Above are space options for our INSIDE space! To help with space planning, we offer many suggestions &amp; tips on how to use your space in the wisest way possible. For example, creative use of book shelves, lights, and cork boards can help build your space. Consider hanging slender metal pipes over your space to hang shirts. All are better than a table with products laying flat on them. Makers that have come to us for tips finish the show with even more display ideas because they had a crash course on using their space wisely! For some of our makers, it’s their first time doing an event and the first time our customer has heard of their shop, so we want to make a great &amp; lasting impression.</p><p><strong>TIPS:</strong></p><p>The 3 feet in the spaces above, describes the DEPTH of your space. The other number is the width. </p><p>You MUST have your shop name listed somewhere in your space. This allows our staff on the floor to quickly answer customer’s questions &amp; for customers to feel like it is a <span style="text-decoration:underline">legit</span> shop, not just some product thrown together.</p><p>Add some OOMPH to your space! Think fresh, hanging greenery, potted plants, or perhaps flowers bordering your peg board. </p><p><a href="https://www.pinterest.com/mermademarket/space-inspiration/" target="_blank" rel="noopener">See our Pinterest board</a> to give you some space inspiration to get those creative wheels of yours flowing in a new way! This is especially helpful if you’ve sold with us before. Keep it fresh! </p><p>Think shelving, think new shapes, think twinkle LIGHTS to show off your amazing product. We offer power to each maker, so be sure to bring your own extension cord with your shop name attached to it. </p><p>Try &amp; get away from the idea of a plain table. Blah. So boring! Of course, some products demand a need for a table, so use the table as support then dream up a better display to go on top.</p>`,
  },
  {
    id: 'inventory',
    q: 'Inventory and restocking',
    html: `<p>It is highly encouraged that you have extra inventory ready to replenish what is out on your display.  Since it’s a 3 day event, unlike other 1 day markets, makers have sold out in the past! It can be a big bummer to see the potential of sales lost for the maker, as well as a loss for Mermade in offering a space that could have been used by a shop that would have been more prepared.</p><p>Our Mermade Team stores and manage restock for our inside makers. If you have a shop space where you can store your restock inventory in  bins hidden away or even in cute bins on a lower shelf, go for it! We will give you instructions on how to organize your restock inventory, both under your space and in the backroom. </p><p>You are also welcome to stop by and restock your shelves, but we ask you do so during the slower hours, usually later afternoon. If you are trying to restock when it’s busy hours, we may ask you to come back later. If you absolutely must come during the busy hours, plan to restock quickly without carrying bulky boxes, sitting in front of your space, spreading out the goods, etc. as it can cause customers to skip shopping your space. As you restock, MAKE SURE ALL RESTOCK ITEMS ARE PRICED! Also note that any change in prices since sending in your inventory sheet, must be reported &amp; emailed ahead of time. Prices cannot be changed on your labels without getting approval from our team first!</p>`,
  },
  {
    id: 'labels',
    q: 'How to label your products',
    html: `<p>We will create a unique Mermade ID for each our of makers and they will be issued to you when you’re accepted to the market. Then 2-3 weeks before the show, we send you detailed info on how to label your products and how to make sure that each product you sell, is in fact, labeled correctly so we can enter it into the Mermade register.</p><p>For example our unique ID will look like this, followed by the price: MM34 $15<br/><br/>Please have every single product clearly labeled with your vendors ID and the price. Make sure they are large enough to be seen quickly at the registers.&nbsp;<strong>However, do NOT have your tag larger than the item you're selling. </strong><br/><br/>Please affix tags neatly and professionally, so they stay put and we can be sure to give you credit for every single sale. If your price isn’t on tag, and there is a line of shoppers, we may have to guess what the price is based on your other items.</p><p>IF YOU DO NOT LABEL YOUR PRODUCTS CORRECTLY OR <strong>AT ALL</strong>, WE WILL TAKE OUT $100 FROM YOUR FINAL PAYMENT.</p>`,
  },
  {
    id: 'treats',
    q: 'Treats on a shelf',
    html: `<p>If you are a “treat” maker, this will be your space! A single (or two) shelf space(s) will be dedicated to your products on a tall bookshelf that sits directly next to the 4 registers. Our loyal Mermade customers looks forward to this because it’s a treat while they shop or wait to check out,  a reward for their mini shopping buddies, and the perfect gift to say thank you to their babysitter for taking the kids while they shopped solo. </p><p>“TREATS ON A SHELF” is 3' x 2'. Shared Shelf for dedicated Treats, 5 book shelves, you get the 5 shelves top to bottom. 2 feet width. </p><p>We’ve learned a lot in the past shows and these treats should not be priced more than $10. Our team makes sure they are replenished often as they sell out quick. We have the option to store excess product for restock in a fridge if needed! If you aren't coming often to restock, or you live far away and aren’t able to restock the fridge/shop space often, we suggest you apply only as an <a href="/makers/outdoor">outside maker</a>. </p><p>We select only 4 makers max for this shelf, so we don’t overwhelm our customers. Only one maker for each category (i.e. one chocolate-y treat.. one baked good...and so on). If you sell multiple treats, we may ask you that you only make one if it conflicts with other makers’ items.</p><p>You will be required to get a <a href="http://www.ocfoodinfo.com/tff" target="_blank">TFF</a>. That’s listed on <a href="/apply">the application page</a> with instructions. Please do not apply for it until you are accepted.</p>`,
  },
  {
    id: 'jewelry',
    q: 'Jewelry makers',
    html: `<p>Tried and tested truths: you cannot sell your items inside plastic bags. Intentions are good with keeping everything organized, but sales show us that people steer clear of them and . it can look/feel tacky. However,&nbsp;we do require that you provide the customer with some sort of take home box or baggie. Customers will bring them to the registers to package up after purchase. If you don’t, we will take $20 off your final sales because we will would provide them all 3 days. We know customers appreciate it so they don’t have to throw their beautiful necklace that will get tangled up in with the other merchandise they buy. I repeat: LEAVE BAGS OR BOXES FOR THEM AT YOUR SHOP SPACE!</p>`,
  },
  {
    id: 'junior',
    q: 'Junior makers, 14 and under',
    html: `<p>We love, love, love including junior makers in our market! They are the perfect addition to our space. Often these kids have been shoppers with their parents at past markets &amp; leave inspired and empowered to start making product, just to sell at Mermade. We are only able to do this option if we get at least 2 approved makers that have a good-fitting product. You are allotted 2 feet WIDE of store space and 3 feet deep. We give you the space shelf so all you need to bring is your finished products!</p><p>Also note, if you have a company that’s been up &amp; running for a while, but you are under 18 yrs, this option doesn’t apply to you. Even if your parent applies for you &amp; if we can see your product is already off to a great start, then you can get your own space. The junior space is very small &amp; not meant for a larger business. If the cost of a full space is what is holding you back, the 3x4 is the smallest one we offer, and sharing it with another maker is $100 split between you.</p>`,
  },
  {
    id: 'advertising',
    q: 'Advertising and social',
    html: `<p>If you wish, we will mail you  stack of postcards to share with customers, family, friends, etc. as well as versions to email and post online.&nbsp;Be sure to leverage all social media: Facebook, Instagram, Twitter,&nbsp;websites and blogs. The more people that know of the market, the more will come see our collective awesome-ness! We recommend avoiding advertising too soon, or else followers can forget or can get tired of hearing about it by the time the market starts. We’ve found that 1 month prior is a great time to start posting/talking, with a few reminders has we get 1 week out and for sure the day of.  * 2021, not sending these flyers bc of Covid</p><p><strong>Social Media Marketing</strong></p><p>If you would like your shop to be featured, send an email to us @ <a href="mailto:hello@mermademarket.com">hello@mermademarket.com</a> and we’ll get your situated. We have options in our <a href="/apply">applications</a> for guaranteed social media shout outs, giveaways &amp; swag if you want to get in on it! We really enjoy reposting &amp; sharing in your excitement using your beautiful photos you post. We can’t do it for every shop in the market year time, but know that we appreciate and love seeing your posts with @mermademarket tagged! If we don’t get tagged, chances are we won’t see it and can’t repost.  If you’d like secure a spot on our high-traffic social media pages, then please inquire on your <a href="/apply">application</a>.</p>`,
  },
  {
    id: 'liability',
    q: 'Liability and security',
    html: `<p>Please know that we do our <em>absolute best</em> to keep your items safe! However, in the unfortunate event that something goes missing or is broken, we cannot be held responsible. We WILL have after-hours security between each event day and we also closely monitor the venue during open hours because we are constantly cleaning &amp; walking around the spaces. </p><p>The full version of what you are agreeing to is in the <a href="/agreement">vendor agreement</a>, alongside the site <a href="/terms">terms</a>.</p>`,
  },
  {
    id: 'more',
    q: 'A few more answers',
    html: `<ul><li>The entire event is free for customers. Inside &amp; outside. Dog friendly, stroller friendly, happy people friendly!</li><li>If you showcased with us in 2025 Fall @ River Street, we could not allow floral, permanent jewelry + cowboy stuff. Now we can! </li></ul><p>More answers are on the <a href="/faq">FAQ</a>, and the dates are on the <a href="/schedule">schedule</a>. Anything else, <a href="/contact">ask us</a>.</p>`,
  },
]

/**
 * /makers/outdoor. Their outside-maker rules, in eleven sections.
 *
 * Same order of arrival: what the track is, whether it suits you, when to be
 * there, the tent, what to pack, then the money rules, the weather, and the
 * housekeeping. The dashes that opened their list lines are real lists now.
 */
export const outdoorSections: PageSection[] = [
  {
    id: 'outside',
    q: 'What selling outside means',
    html: `<p>Each day of our show, {{outdoorCapacity}} provided Mermade tents are set up for you (by our team).  Dimensions are under “Your tent and display” below, because they are not your typical EZ Up size. </p><p>As an outdoor maker, you'll have the opportunity to connect in person, amongst delicious coffee &amp; food makers, plus other talented shop owners like yourself!</p><p>One of the best parts about it (as a shopper) is…each new day of the market, the outside maker tents change! It makes for a magical experience for our customers and keeps them coming back for more. You’ll find you will see a lot of the same customers coming back each day. It’s really fun! </p><p>If you sign up as an outside maker, choose which day(s) fit best for your schedule! If you choose more than 1 day, that lets us know you’re open &amp; flexible, increasing your chances you’ll get in the show. With this option, you pay a booth fee only and NO Mermade commission is taken. There is also a chance your shop can come twice or even three times if your shop is in a category that is lacking on other days.</p>`,
  },
  {
    id: 'fit',
    q: 'Is outside right for you',
    html: `<p><em><strong>How do I know if my shop is a candidate for outside selling?</strong></em></p><ul><li>If your product takes some talking about or explaining.</li><li>If 50% (or more) of your products are priced more than $100.</li><li>You LOVE to interact with your customers! In fact, you thrive off of their energy and interest. Some makers later tell us they felt they missed out on the fun when they did the inside portion, and would later apply for outside, and loved it!</li><li>If 50% (or more) of your products are custom, you definitely want to be there for those conversations with customers.</li></ul><p><em><strong>How do I know if I’m NOT a candidate for outside selling?</strong></em></p><ul><li>You don’t like to talk to strangers (ei. small chat, smiles &amp; hellos)</li><li>You don’t enjoy selling direct/convincing customers to buy your products.</li><li>You don’t like the pressure of selling direct, feel like you might hang out on your phone or nervously duck out. </li><li>You have a busy home/work life and can’t sneak away for a full day or two selling. </li></ul><p>By choosing "outside vendor" <strong>you are physically there</strong>, selling at your space,<strong> </strong>and <strong>ENGAGING </strong>with customer! Note - if you marked Outside Maker AS WELL as an <a href="/makers/indoor">inside space</a>, that tells us you are OK with being chosen for either. However, you cannot do both. If you only want to be there and sell, make sure you <em>only mark </em>Outside Vendor on your <a href="/apply">application</a>. </p>`,
  },
  {
    id: 'schedule',
    q: 'The schedule',
    html: `<p>Let’s make sure you can be there, before you apply! The final schedule will be uploaded as the show gets closer.</p><div class="timetable"><table><tbody><tr><th scope="row">{{day1Date}}</th><td>Set up begins at 7am.  Market officially opens @ 9am and closes 6pm. </td></tr><tr><th scope="row">{{day2Date}}</th><td>Set up begins at 7am. Market opens @ 9am and closes 5pm.  </td></tr><tr><th scope="row">{{day3Date}}</th><td>Set up begins at 7am. Market opens @ 9am and closes promptly at 5pm.</td></tr></tbody></table></div><p>The final schedule is sent a week prior to the show (live music, etc). It goes up on the <a href="/schedule">schedule page</a>.</p>`,
  },
  {
    id: 'tent',
    q: 'Your tent and display',
    html: `<p class="mk-inspo"><strong>Before you plan your space:</strong> <a href="/lookbook/outdoor">see real outdoor tents from past shows</a>, and <a href="https://www.pinterest.com/mermademarket/space-inspiration/" target="_blank" rel="noopener">our Pinterest board of display ideas</a>.</p><p><strong>TIPS:</strong></p><ul><li>Our provided tents are 6.5 feet x 6.5 feet + 7.5 tall. A few 10x10's will be offered. </li><li><strong>You are NOT allowed to display a table up front blocking your tent because we need to keep the space avail for shoppers + emergencies.</strong></li><li>You MUST have your shop name listed somewhere in your space. <strong>NO VINYL SIGNS !!!!</strong> This allows our staff to quickly point a customer to your space, helps customers get to know your name and product, plus, it feels well rounded for customers to feel like it is a legit shop, not just some product thrown together.</li><li>Add some OOMPH to your space! Think fresh, hanging greens or potted plants or perhaps flowers bordering the tent legs.</li></ul><p><a href="https://www.pinterest.com/mermademarket/space-inspiration/" target="_blank" rel="noopener">See our Pinterest board</a> to give you some space inspiration to get those creative wheels of yours flowing in a new way! This is especially helpful if you’ve sold with us before. Keep it fresh! Think shelving, think new shapes, think twinkle LIGHTS to show off your amazing product. We offer power to each maker, so be sure to bring your own extension cord with your shop name attached to it. </p><p>Try &amp; get away from the idea of a plain table. Blah. So boring! Of course, some products demand a need for a table, so use the table as support then dream up a better display to go on top.</p><p>It is mandatory to have some sort of backdrop hung in your tent. It hides the background, hides neighboring tents and it keeps the customer feeling like you have your own collected shop space. Curtains with holes for zip ties work great.</p><p>When the light starts to fade for sunset around 5pm, we suggest turning on your lights so our customers can see your product and to add to the ambiance. Be sure to bring some extension cords with your name taped to it and string up some lights or set up some lamps. Take our advice, when makers DON'T bring any lights, they're always bummed out and miss out on the evening party. </p><p>If you are a first timer to our show and feel you may need extra help working through how to display your product, please <a href="/contact">check in with us</a>! We want your booth to elevate your products and keep the customer at your table longer than a quick, walk by. </p>`,
  },
  {
    id: 'bring',
    q: 'What to bring on set-up day',
    html: `<ul><li>Your own POS (Point of Sale) System &amp; Portable Wifi.</li><li>Comfortable chair/stool.</li><li>A buddy to keep company and to stay at your booth while you take a break or need to restock, etc.</li><li>Extra cash &amp; change, we cannot to help this, but of course check with neighboring tents if you need to break a big bill. We’re in it together!</li><li>Extension cords (we will hook you up with electricity) &amp; hanging lights. Cannot stress lights enough! It makes evenings MAGICAL. </li><li>Zip ties, your backdrop, masking/duct tape, scissors, random tools. Heck, bring a tool box.</li><li>Weights to go at the bottom of the EZ up &amp; other display items, for unexpected strong wind. A must!</li></ul>`,
  },
  {
    id: 'inventory',
    q: 'How much inventory to bring',
    html: `<p>We aren’t quite sure since we aren’t in charge tracking outside sale (tracked by makers individually). Just know that most of the makers report that they have made better sales than any other show and some have even tripled previous sales in just one selling day! You’d rather have more inventory than miss a sale, right? Plan to have a place to hide your restock or perhaps keep tucked away in your trunk and your buddy can run to the car midday to grab it if you need it. If you are a regular to shows, just pretend like it’s another show, but with a little extra inventory. If you want to talk to past makers about their inventory stock, click <a href="https://www.facebook.com/groups/1561433787287671/?source_id=1459193224292182" target="_blank">here for our facebook group</a>, to send them a private message on their sales &amp; inventory. You have to request to be apart of the group and we will accept “Requests” after you’ve been accepted into the show.</p><p>Outside Makers will no longer be allowed to hide their display items &amp; goods for the next day. Chances are slim outside makers can come two days in a row because we are downsizing how many outside makers can be there. </p>`,
  },
  {
    id: 'refunds',
    q: 'Refunds and cancellations',
    html: `<p>We understand that life happens and things come up, however the amount of work done prior to the show, is tremendous. All spaces are nonrefundable and you’ll be reminded of this when you pay your invoice. It is listed in our <a href="/apply">application process</a> and by submitting &amp; paying you are agreeing to a nonrefundable fee. The whole of it is in the <a href="/agreement">vendor agreement</a> and the site <a href="/terms">terms</a>.</p><p>We do a <em>LOT</em> of advertising for your small shop on our website and on Instagram/facebook in advance. The fee of your outside space is minor when you consider all of the eyes online (aka MARKETING!), clicking your shop, and shopping during &amp; after the market. A lot of makers think if they find a replacement for us, it pays for the fee…but unfortunately, it’s a lot more work trying to educate the replaced maker and get them up to speed. </p><p>We do however, offer up your fee to carry through to the next show with no extra charge. It’s up to you to contact us during the application period to make sure everything still applies. If you don’t reach out to us, it’s on you. </p><p><strong>Cancellations:</strong> No refunds allowed if you must cancel! If you want an extra day of selling, this is occasionally possible and will be priced at half the price of your space fee.</p>`,
  },
  {
    id: 'weather',
    q: 'What if it rains',
    html: `<p>If it rains the week leading up to the show, we will use our best judgement as to whether the outside show will go on each day. We ask for flexibility and we beg that you know that we can’t control the weather! We are humans, like you, with a high understanding of how much it means to you that it must not rain on your big day. If we cancel the show because it will be too stormy for shopping outside and for setting up your precious goods, we will give you the opportunity to automatically participate in the next show, on the same day you purchased. If you decide to not do the next show, we will reimburse you for 30% of your shop fee. We cannot fully reimburse you because of the marketing efforts on our instagram &amp; website that is done leading up to the show. If the show is still happening despite less-than-perfect weather and y<em>ou choose to not come</em>, <em>we will not give you another day in a future show</em>.</p>`,
  },
  {
    id: 'rules',
    q: 'The rules',
    html: `<ul><li><strong>Outside makers</strong> are not allowed to piggyback and sell with any <a href="/makers/indoor">inside makers</a>. If we see this happening, you won't be allowed to showcase with us in a future show. Example: you have an actual brick &amp; mortar shop and you’re selling with us outside to promote it and sell all your gorgeous goodies, but notice that one of your wholesalers is selling inside with us, you are NOT allowed to go grab some pieces to add to your outdoor space, even if the inside maker said it was allowed.</li><li><strong>Can I cruise around and hand out freebies? </strong>While we appreciate the ambitious marketing… the answer is<strong> </strong>no. We have thoughtfully assigned your spot in the maker lay out and don’t want to frustrate other makers. BUT you can <em>definitely</em> handout freebies at your space, and do something to serve the customers like a free kids craft for shoppers. Get creative here and use your freebies wisely!</li><li><strong>Can I play my own music in my shop space?</strong> No. We have music dialed for Mermade so no need to worry about this! </li><li><strong>MLMs</strong>: We 99% of the time do not accept MLMs. If you want to promote your MLM with Mermade Market and you can creatively come up with a way to do it by making a product using it, we are open to the idea! For example, we have approved an oil MLM who created beautiful bath bombs using their oils, giving mention to the MLM company that helped create the product. Your shop name cannot have the MLM in it.</li></ul>`,
  },
  {
    id: 'advertising',
    q: 'Advertising and social',
    html: `<p>If you want, we will send you a stack of postcards to share with customers, neighbors, family, friends, etc. as well as versions to email and post online.&nbsp;Be sure to leverage all social media: Instagram, Twitter,&nbsp;facebook, websites and blogs. The more people that know of the market, the more will come see our collective awesome-ness! We recommend avoiding advertising too soon or else followers can forget or can get tired of hearing about it by the time the market starts. It’s a highly curated show and it’s a great accomplishment to be accepted so word of mouth &amp; genuine excitement around the time you’re accepted is great too! We’ve found that 1 month prior is a great time to start posting/talking, with a few reminders has we get 1 week out and for sure the day of. </p><p><strong>Social Media Marketing</strong></p><p>We have options in our <a href="/apply">applications</a> for guaranteed social media shout outs, giveaways &amp; swag if you want to get in on it! We really enjoy reposting &amp; sharing in your excitement using your beautiful photos you post. We can’t do it for every shop in the market year time, but know that we appreciate and love seeing your posts with @mermademarket tagged! If we don’t get tagged, chances are we won’t see it and can’t repost.  If you’d like secure a spot on our high-traffic social media pages, then please inquire on your <a href="/apply">application</a>.</p>`,
  },
  {
    id: 'liability',
    q: 'Liability',
    html: `<p>Know that we do our absolute best to keep your items safe! However, in the unfortunate event that something goes missing or is broken, we cannot be held responsible.</p><p>The full version of what you are agreeing to is in the <a href="/agreement">vendor agreement</a>, alongside the site <a href="/terms">terms</a>.</p>`,
  },
  {
    id: 'more',
    q: 'A few more answers',
    html: `<ul><li><strong>Communication: </strong>Upon acceptance, our team will be in quick communication with you. We will send you deadlines &amp; dates to expect information &amp; details. You can email our team directly at <a href="mailto:hillary@mermademarket.com">hillary@mermademarket.com</a> </li><li><strong>Which day is the busiest? </strong>They are ALL THE SAME. This is totally 100% evident in our sales history, thus the same booth fee per day. our customers are fiercely loyal and most of them come back each and everyday! </li><li>If you were around during our Fall 25 show @ River Street, this one is totally back to normal, allowing floral &amp; permanent jewelry &amp; cowboy stuff! Yipee!!</li></ul><p>More answers are on the <a href="/faq">FAQ</a>, and the dates are on the <a href="/schedule">schedule</a>. Anything else, <a href="/contact">ask us</a>.</p>`,
  },
]


export const thankYou = "<p>Yeeew! You took the time and we appreciate it! We know it wasn't easy.. A member of our team will be in touch in the next few weeks. If we have questions you will hear from us sooner than later. </p><p>Please be patient and know we are doing our best to curate the best market we could give you!</p><p><strong>Inside Makers: </strong>If you do not have a solid website/instagram, please email photos of your product to hello@mermademarket.com with the subject line: \"  Shop Name + Shop space you're applying for.. ie: \"Mama's Notebooks\" </p><p>If you came here and applied after March 12, you are now on the waitlist and may not hear from us at all. </p><p><strong>Outside makers:</strong> Inside makers: If you do not have a solid website/instagram, please email photos of your product to hillary@mermademarket.com with the subject line: \"  Shop Name + Shop space you're applying for.. ie: \"Mama's Babies, Saturday Only\"</p>"

/** The eight tabs under "Merchant Application FAQ" on their apply page. */
export const applyFaq: Array<{ q: string; a: string }> = [
  {
    "q": "Application Information",
    "a": "<p>Mermade Market is a truly unique shopping experience, and we\u2019re thrilled that you\u2019re interested in becoming one of our official makers.</p><p>Our upcoming {{showName}} show will take place {{dateRange}} at the Dana Point {{venue}}, a beautiful coastal venue just steps from the ocean. We work hard to curate an incredible mix of talented makers and passionate shoppers, creating an atmosphere that is both inspiring and profitable for our vendors.</p><p>Our team prides itself on being organized, thorough and supportive, from the application process all the way through market weekend. We actively promote our makers on social media before, during, and after the show, and we do everything we can to bring the right audience through the doors.</p><p>Whether you\u2019re looking to grow your brand, meet other makers, or have a fantastic sales weekend, Mermade Market is built to help you do all three. And if you\u2019re not here to make some extra money, you\u2019ll certainly leave with meaningful connections and a lot of new friends.</p><p>Because our show operates a bit differently than many traditional markets, we want to make sure every maker understands exactly how things work and what will be expected. That\u2019s why our application is a bit detailed, so hang with us, it\u2019s worth it.</p><p>Don\u2019t worry if you don\u2019t have every answer right away. If you\u2019re accepted, we\u2019ll provide a full vendor packet with all the details you\u2019ll need. You can also explore additional information throughout our site under \u201cIndoor Makers\u201d and \u201cOutdoor Makers.\u201d</p><p>For reference, we typically welcome around 5,000 to 6,000 visitors over the course of the weekend, making Mermade Market one of the most vibrant maker events in South Orange County.</p><p>Thank you so much for applying. We can\u2019t wait to see what you\u2019re creating.</p>"
  },
  {
    "q": "Our Mission with Applications",
    "a": "<p>Our mission is to bring our customers the freshest goods so they can feel great about buying for themselves and gifting to everyone they love! We work to keep it the <em>cool place</em> to shop. We like keeping our market curated and approachable so you aren\u2019t overwhelmed with too many options. We avoid having multiple shops with similar product. Customers and makers alike don\u2019t like having seven jewelry shops at the same market and we\u2019ve taken note! We also don't feature tired styles that we've seen a lot at craft shows.</p><p>While carefully reviewing applications, we will be selecting a few makers (maybe even just one!) within each category. For instance, if we get 15 applications from shops selling leather goods, we will choose 1 or 2 vendors in this category. It is tried and true - the best way to highlight our makers! Customers get bored and quickly shop through duplicate products from makers, rather than taking their time to take in each individual and unique shop. It also makes each vendor have a successful turnout! In additional, our selection is based on customer demand. Fresh & innovative, always!</p>"
  },
  {
    "q": "When are booth fees due",
    "a": "<p>Shop space fees are due no later than <span style=\"text-decoration:underline\">{{paymentWindow}} hours</span> of being accepted & invoiced. If you do not pay, we will give your space to another willing maker. We always have a waitlist of makers that we are eager to offer space to! See above for pricing for inside & outside maker shop spaces. Because we offer so many different types of spaces,  note the variations in pricing options!</p><p> The inside space is register/retail style so you will not physically stand at your space to sell. We take {{commission}}% of each sale from our inside makers. Customers shop with a basket provided by Mermade and check out with our team at one exit point. </p><p>For the outside market space, you are right there - farmers market style - and you collect 100% of your sales via your preferred payment methods.</p>"
  },
  {
    "q": "How long are applications open",
    "a": "<p>They are only open for {{windowDays}} full days. Once they\u2019re closed, they remain closed until the following show. We get an abundance of amazing makers and the review process starts the moment applications open. By day 15-18, we have a pretty good idea of what makers have made the cut and the official acceptance process starts soon after. You are welcome to join the waitlist, although it's rare we glance at it once the ball gets rolling.</p>"
  },
  {
    "q": "What happens if I'm not accepted",
    "a": "<p>Because we get hundreds applications, we can only accept a certain number for our specific vibe and market size. There may be multiple reasons we may not choose you for this particular market: there may not be enough space or you\u2019re a veteran maker and we gotta let someone else give Mermade a try! Perhaps your product doesn\u2019t quite fit with our aesthetic & our customer\u2019s style or your brand isn\u2019t fully solidified yet. We do take into consideration at your social media presence/vibe and website. If you\u2019ve been selling at markets for years and do really well, but might be lacking beautiful pictures and a strong online presence to show it, we highly advise you brush up on it all before you submit an application. </p><p> Please look at non-acceptance as a chance to learn, grow, and move forward. There\u2019s always the possibly to try again in the future! We love growth and <span style=\"text-decoration:underline\">especially</span> love when we see makers re-apply with a stronger brand and product in the future. It can always be looked at as part of the process of owning a business, as motivation to get grow! Our standards are high and our vision - very curated and precise. Our biggest goal is to bring the very best products to our customers and for our fantastic makers to have their shop showcased amongst other equally amazing makers. If you have a question about why you weren\u2019t approved and are open to feedback, we would love to chat with you!</p>"
  },
  {
    "q": "If I'm a food vendor do I need a permit",
    "a": "<p>YES. The Health Department requires us to gather applications & fees from each maker. <a href=\"http://www.ocfoodinfo.com/tff\" target=\"_blank\">Click this link to see what it will entail</a>. You will print & mail your application to them in Santa Ana or go in person. </p><p>Deadline for submitting this permit will be enclosed in your application. Note, there are shared kitchens if you search in your area! Sometimes local shops/restaurants will let you use their  kitchen, info, and address. Just check in with your local restaurant owners! </p><p>If you are making your food at home and not using a commercial kitchen, you need a \u201ccottage\u201d food license. Here is the link for Orange County: <a href=\"http://www.ocfoodinfo.com/cottage\" target=\"_blank\">http://www.ocfoodinfo.com/cottage</a>. You must get your cottage license on your own, as it sets you up for one year of use and you will be able to do many events with this license. </p>"
  },
  {
    "q": "Inside merchants - when do I get paid",
    "a": "<p>We send your payment 7-10 days after the last date of market with a detailed sales report.</p>"
  },
  {
    "q": "Want to promote your business",
    "a": "<p>Want to promote your business by offering a free activity during the show? <a href=\"https://docs.google.com/forms/d/e/1FAIpQLSeH-DagLwRozQY-e2_HeyJEL3Ym6VyWSF0oXlJeFPRBfltLNQ/viewform\" target=\"_blank\">Click here to apply! </a></p>"
  }
]
