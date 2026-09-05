/**
 * The two merchant lookbooks, from mermademarket.com/pages/indoor-lookbook
 * and /pages/outdoor-lookbook.
 *
 * Photographs are the market's own, pulled from their CDN and resized. Each
 * caption belongs to the space above it on the live page, so the pairing here
 * is theirs and not a guess: the live HTML puts every image immediately
 * before its heading, and both pages were read in document order.
 *
 * The prose is theirs, unedited. It critiques specific makers' spaces, so a
 * wrong pairing would attach a criticism to the wrong person's booth. If the
 * photographs are ever re-cut, re-derive this file rather than reordering it
 * by hand.
 */
export type LookbookShot = { src: string; title: string; body: string }

export const indoorShots: LookbookShot[] = [
  {
    src: '/lookbook/indoor/01.jpg',
    title: '3x4 space "PEGBOARD"',
    body:
      'Over here at mermade we are pretty anti- "tables" because we feel it\'s a cop-out and the easiest way to display. We applaud our makers that make the most out of getting creative & find sometimes its easier than they thought! Cue....the peg board! This is exactly 4 feet wide and she crushed it!',
  },
  {
    src: '/lookbook/indoor/02.jpg',
    title: '3x4 space "CLEAN"',
    body:
      'A minimal clean peg board is a great way to make up a pretend shopping area. No weird curtains or table cloths. You can mix & match where you want the actual shelves to go. This space would have been a bit better if she had a sign at the top rather than sitting on the shelf. Perhaps a vinyl STICKER.',
  },
  {
    src: '/lookbook/indoor/03.jpg',
    title: '3x4 space "ELEVATED"',
    body:
      'Both of these pictured side by side are 3x4\'s, and the one closest is a little more elevated because there are lights, clean panels of wood to make a pretend wall/shelving unit. The sign is classic & clean and not vinyl.',
  },
  {
    src: '/lookbook/indoor/04.jpg',
    title: '3x4 space "SHELVING"',
    body:
      'A simple display shelving unit for a 3x4 space for a stationary shop. Nothing crazy fancy but it is minimal and nothing distracts us from seeing the product clearly. There\'s height so our customers aren\'t bending over and can easily shop.',
  },
  {
    src: '/lookbook/indoor/05.jpg',
    title: '3x4 space "ORGANIZED"',
    body:
      'Peg boards are the bomb! If they are done right. These two panels are exactly two feet wide each so he understood the assignment! We can see each tie clearly and they stayed separated so our team could easily restock and customers can see the separate styles without issues. It would have added a bit of umph had he had a lamp clamped in the middle of the two boards but it worked out!',
  },
  {
    src: '/lookbook/indoor/06.jpg',
    title: '3x4 space "cREATIVE"',
    body:
      'We loved this 3x4 space! Felt really accessible & tall and we could see every product easily. We were stoked to have it in the front!',
  },
  {
    src: '/lookbook/indoor/07.jpg',
    title: '3x4 space "DIMENSION"',
    body:
      'Another clean wood wall with some small pegs attached. She could have made the card shelves on the actual wood board rather than a separate one but we appreciated the idea and creativity she displayed. The little dresser was a nice touch and tall tree for height. It was a Holiday show afterall!',
  },
  {
    src: '/lookbook/indoor/08.jpg',
    title: '3x4 space "LIGHTS"',
    body:
      'He made this massive shelf unit kind of like a deep shelf because his product needed them to be housed as such. So instead of it being a dark hole, he added lights inside & outside and it was the bomb!',
  },
  {
    src: '/lookbook/indoor/09.jpg',
    title: '3x6 space "DIMENSION"',
    body:
      'Vertical space is everything!!! Especially with clothing. Make sure if you include a rug, its not too big and it is ducted tape down.',
  },
  {
    src: '/lookbook/indoor/10.jpg',
    title: '3x6 space "THOUGHTFUL"',
    body:
      'A table that doesn\'t feel like a table. Underneath is her restock but it\'s so beautiful that it doesn\'t feel like a swap meet. She had lights that are rechargeable to highlight her beautiful products & the shelving was very thought out. A favorite from 2023!',
  },
  {
    src: '/lookbook/indoor/11.jpg',
    title: '3x6 space "SIMPLE"',
    body:
      'Modern & beautiful banner / makes shopping seamless because I can see everything and can tell what is what.',
  },
  {
    src: '/lookbook/indoor/12.jpg',
    title: '3x6 space "NO TABLE"',
    body:
      'VERTICAL SPACE! No table but a small bench.',
  },
  {
    src: '/lookbook/indoor/13.jpg',
    title: '3x6 space "EVERYTHING RIGHT"',
    body:
      'She has a small shelf attached to this amazing wood board set up. Basically created a small shopping area for her shop space. Super creative!',
  },
  {
    src: '/lookbook/indoor/14.jpg',
    title: '3x6 space "ORGANIZED"',
    body:
      'She has a table BUT the shelf on top of it is the show stopper. Brings HEIGHT to our shoppers and no one is bending over to see what\'s for sale.',
  },
  {
    src: '/lookbook/indoor/15.jpg',
    title: '3x6 space "lights"',
    body:
      'See how the lights help our makers SEE ?? Shadows do happen when the light changes/clouds come over so we really want our makers to come prepared and set up some cool lights!',
  },
  {
    src: '/lookbook/indoor/16.jpg',
    title: '3x6 space "WALLS"',
    body:
      'Both of these spaces are 3x6 feet. The taller one became like a mini shopping space with her two walls on each side. It\'s totally allowed as long as you stay within the 3 feet deep limit! Also, would be nice to know if you do this so we can alert your next door neighbor so they can bring lights so light up the space that may be affected by it. They could also possibly use the backside of that space if you allow!',
  },
  {
    src: '/lookbook/indoor/17.jpg',
    title: '3x6 space "MINIMAL"',
    body:
      'Simple space, this could be TALLER but we appreciate the minimalistic approach. She has her restock under the tablecloth & just tucked behind for quick access.',
  },
  {
    src: '/lookbook/indoor/18.jpg',
    title: '3x8 space "SHELVING"',
    body:
      'We love the way the lights she used helps light up her jewelry! Yes she has a table but it was a vehicle for her great wood shelving and deserved the recognition. Her restock is underneath this space.',
  },
  {
    src: '/lookbook/indoor/19.jpg',
    title: '3x8 space "SHELVING & LIGHTS"',
    body:
      'Another view of the jewelry just above. Look at those beautiful shelves with lights!!!!',
  },
  {
    src: '/lookbook/indoor/20.jpg',
    title: '3x8 space "INVITING"',
    body:
      'With a large space such as 8 feet, lots of dimension can happen! We appreciate the lights & variety she sells and the depth in which we see. Her sign is also just the right size.',
  },
  {
    src: '/lookbook/indoor/21.jpg',
    title: '3x8 space "NOSTALGIC"',
    body:
      'Obsessed with this creative space! It was a holiday show and she took full advantage of it! The lights behind the cut out windows were so creative & inviting. The dimension, the peg board, the rack with stockings was the cherry on top. Everything you see was basically for sale except the actual display. She hit it out of the park!',
  },
  {
    src: '/lookbook/indoor/22.jpg',
    title: '3x8 space "MINIMAL"',
    body:
      'Very VERY simple and sometimes that\'s the best route. We can see every single item being sold & was geared towards men. Their shop space was battery powered and we could turn it on each morning. Back stock was in the back room because he didnt have a boring table! The shelves were customizable and he spent time desiging it before he left. Each board was 4 feet wide.',
  },
  {
    src: '/lookbook/indoor/23.jpg',
    title: '3x8 space "FILLED UP"',
    body:
      'She clipped each and every wooden box so that they didnt move around. She stablized the back of it so it didnt tip over. It was SO CREATIVE & we have dreamt of this space ever since!',
  },
]

export const outdoorShots: LookbookShot[] = [
  {
    src: '/lookbook/outdoor/01.jpg',
    title: 'DIMENSION',
    body:
      'She used every inch of her 6.5 feet allotted space but customers were still able to walk around and shop INSIDE of it and it felt airy and inviting.',
  },
  {
    src: '/lookbook/outdoor/02.jpg',
    title: 'HEIGHT',
    body:
      'We loved that her display went basically to the max height it could go because it felt intentional and she took her assignment seriously. Her pillows stayed off the floor and were well displayed and SEEN!',
  },
  {
    src: '/lookbook/outdoor/03.jpg',
    title: 'INVITING',
    body:
      'This walk-in space was so dreamy with all the holiday spirit. Notice her cute little register table she sat behind but had a high stool so she wasn\'t committed to hiding behind it while customers shopped. If you find out you have a corner or have a little bit of space around you, feel free to talk with Hillary or a team member about going outside your 6.5 feet. We still want to make sure our customers can WALK and move their strollers/wheel chairs around with ease.',
  },
  {
    src: '/lookbook/outdoor/04.jpg',
    title: 'DAINTY DETAILS',
    body:
      'We love to see the tiny details that make a space what it is. Fresh florals, mirrors that align well with the product (notice the brass details..) the risers, the tiny succulent. She crushed it!',
  },
  {
    src: '/lookbook/outdoor/05.jpg',
    title: 'COME ON IN',
    body:
      'Notice how she\'s not hiding behind her space? Or has a big table blocking her from the walking by customers? Pretty sure she also moved this chair for the maker picture, the chair was on the side a bit, but she is inviting her customers to come in with her big vertical peg board wall. To touch, and feel everything. She has a rack on the side that goes with her theme of cotton macrame. She filled almost the entire back of the 6.5 feet with the wood wall! Epic!',
  },
  {
    src: '/lookbook/outdoor/06.jpg',
    title: 'INTERACTIVE',
    body:
      'This maker was a delight! He made great sales & also made friends! He was demo\'ing his s\'more sticks and selling them at the same time!',
  },
  {
    src: '/lookbook/outdoor/07.jpg',
    title: 'CLEAN',
    body:
      'This beautiful display knocked it out of the park. This is just a tiny part of it! She had every scent of candle displayed there to smell and the rest of her stock behind it. She interacted with each and every customer.',
  },
  {
    src: '/lookbook/outdoor/08.jpg',
    title: 'MULTI-TASKING',
    body:
      'She used her products as a way to help her space feel elevated. As they would sell she would replenish. This pegboard was on the corner of her space and helped invite people to see what else she had.',
  },
  {
    src: '/lookbook/outdoor/09.jpg',
    title: 'Secret garden',
    body:
      'We LOVED the display of the eucalyptus along the corner of the front of this. Realllyyyyy made people curious and felt like a fort inside there with the cute twinkle lights set up. She did a stellar job!',
  },
  {
    src: '/lookbook/outdoor/10.jpg',
    title: 'BANNER',
    body:
      'To say we are obsessed with this banner is quite the understatement! It\'s timeless, effortless & takes over the entire back of it so shoppers focus their attention on what really matters..her product.',
  },
  {
    src: '/lookbook/outdoor/11.jpg',
    title: 'ORGANIZED',
    body:
      'This shop space felt organized & intentional. Each basket had it\'s own category with the price tag next to the name of the product ..ie. Medium -16, Large-18... So shoppers could shop with ease without needing to ask the maker how much things are! The holiday garland helps keep it cozy and could easily become a spring garland!',
  },
  {
    src: '/lookbook/outdoor/12.jpg',
    title: 'INTENTIONAL',
    body:
      'This shop space felt collected and thought through. Every inch was accounted for but shoppers could still walk in and feel apart of it. Enveloped by it perhaps. She always knocks it out of the park! On the side she was making wreaths right on site! This can be done if you get the right spot!',
  },
  {
    src: '/lookbook/outdoor/13.jpg',
    title: 'PERSONALITY',
    body:
      'This maker booked out TWO tents so she would be able to sell her furniture with ease. She had it open & ready for customers to walk in. It helped that she enjoyed talking to each & every one of them!',
  },
  {
    src: '/lookbook/outdoor/14.jpg',
    title: 'STUNNING',
    body:
      'She was selling her grazing boards and wanted to lay out all the ideas of foods she offers here on this beautiful table. Her backdrop was massive dried palms & her simple circular sign that was handmade. She crushed it! She used risers & dried florals & all the things to help inspire the customer during the next time they host. She\'s inspiring! This is also Hillary, before she started working at Mermade! Shes so talented! (if you want to order..get it here! )',
  },
  {
    src: '/lookbook/outdoor/15.jpg',
    title: 'SIMPLE & modern',
    body:
      'She didnt have one table in her tent! All about the shelving here & it was simple & perfect. Made your decision of which mug you wanted to buy much easier.',
  },
  {
    src: '/lookbook/outdoor/16.jpg',
    title: 'LESS IS MORE',
    body:
      'She could have easily had those racks that we all see at all the markets. She instead, made (or bought) this gorgeous folding wall to display her hats & didn\'t fill her space with EVERY SINGLE PRODUCT she had which can be tempting to do. Less is most definitely more!',
  },
  {
    src: '/lookbook/outdoor/17.jpg',
    title: 'CREATIVE',
    body:
      'Instead of having her blankets folded on a table, she created these gorgeous knots for display. Loved it so much! Think outside the box!',
  },
  {
    src: '/lookbook/outdoor/18.jpg',
    title: 'COZY NIGHT',
    body:
      'The ideal look for that evening sunset time that you all will have! Even if it\'s the last 90 minutes of the selling day. Saturday will be open until 8pm! Don\'t forget those lights & extension cords, folks! This spot is from our old location.',
  },
]
