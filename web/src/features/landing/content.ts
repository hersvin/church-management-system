/**
 * Public landing page content. Static for now: the full public site with live
 * service times, events, and visitor forms is Phase 8 of docs/ROADMAP.md, which
 * can replace these values with API data without touching the layout.
 *
 * Church name, tagline, campuses, service times, ministries, and rooms match the
 * seed data in packages/database/seed/data. Team names and room rates are samples.
 */

export type MinistryMark =
  | "worship"
  | "kids"
  | "hospitality"
  | "youth"
  | "prayer"
  | "outreach";

export interface LandingLink {
  label: string;
  href: string;
}

export interface Campus {
  name: string;
  address: string;
  services: string[];
}

export interface GalleryItem {
  title: string;
  caption: string;
  /** No photography is supplied yet; each tile renders a labelled placeholder. */
  placeholder: true;
  brief: string;
}

export interface Step {
  title: string;
  body: string;
}

export interface Person {
  name: string;
  role: string;
  /** Campus shown on the profile card. */
  campus: string;
  /** Portrait; until supplied, the card shows a labelled placeholder with initials. */
  photo?: string;
}

export interface RoomPlan {
  name: string;
  capacity: number;
  /** Philippine pesos per hour. */
  ratePerHour: number;
  bestFor: string;
  includes: string[];
}

const sectionIds = {
  times: "times",
  ministries: "ministries",
  life: "life",
  visit: "visit",
  team: "team",
  rooms: "rooms",
  watch: "watch",
  contact: "contact",
} as const;

const campuses: Campus[] = [
  {
    name: "Main Campus",
    address: "100 Grace Avenue, Springfield",
    services: ["Sunday 8:00 AM", "Sunday 10:30 AM", "Wednesday prayer 7:00 PM"],
  },
  {
    name: "North Campus",
    address: "25 Hillside Road, Springfield North",
    services: ["Sunday 9:30 AM family service", "Friday youth night 6:30 PM"],
  },
  {
    name: "South Campus",
    address: "8 Riverside Drive, Springfield South",
    services: ["Sunday 4:00 PM"],
  },
];

export const LANDING = {
  sectionIds,
  church: {
    name: "Grace Community Church",
    email: "hello@cms.local",
    phone: "+1 555 0100",
  },
  announcement: {
    long: "Christmas Eve candlelight services, 24 December at 6:00 and 9:00 PM.",
    short: "Christmas Eve, 6 and 9 PM.",
    link: { label: "See times", href: `#${sectionIds.times}` },
  },
  nav: [
    { label: "Visit", href: `#${sectionIds.visit}` },
    { label: "Ministries", href: `#${sectionIds.ministries}` },
    { label: "Team", href: `#${sectionIds.team}` },
    { label: "Room hire", href: `#${sectionIds.rooms}` },
  ] satisfies LandingLink[],
  hero: {
    title: "Where Lives Change",
    lede: "Sundays at 8:00 and 10:30 AM at Main Campus, 100 Grace Avenue. Kids Church runs during the 10:30 service, with secure check‑in at the door.",
    primary: { label: "Plan your first visit", href: `#${sectionIds.visit}` },
    secondary: { label: "See service times", href: `#${sectionIds.times}` },
    trust: [
      "Three campuses in Springfield",
      "Six ministries to join",
      "Kids released only with a pickup code",
    ],
    photo:
      "Sunday worship in the Main Campus sanctuary, landscape, 2400 × 1350 or larger.",
  },
  ministries: {
    title: "Six ministries, one family.",
    caption:
      "Every ministry meets at least monthly. Most welcome newcomers in their first week.",
    items: [
      {
        mark: "worship",
        name: "Worship Team",
        detail: "Sundays and Thursday rehearsal",
      },
      {
        mark: "kids",
        name: "Kids Church",
        detail: "Ages 3 to 12, Sunday 10:30",
      },
      {
        mark: "hospitality",
        name: "Hospitality and Ushers",
        detail: "Welcome desk and seating",
      },
      {
        mark: "youth",
        name: "North Youth",
        detail: "Ages 13 to 18, Friday nights",
      },
      { mark: "prayer", name: "Prayer Circle", detail: "Wednesday 7:00 PM" },
      {
        mark: "outreach",
        name: "Community Outreach",
        detail: "Monthly feeding and visits",
      },
    ] satisfies { mark: MinistryMark; name: string; detail: string }[],
  },
  /** Names and titles of Jesus for the marquee above the ministries, one array per row. */
  namesOfJesus: [
    ["Emmanuel", "Prince of Peace", "Good Shepherd", "Light of the World", "Bread of Life", "Lamb of God", "Messiah"],
    ["King of Kings", "Lord of Lords", "Wonderful Counselor", "Mighty God", "Everlasting Father", "Alpha and Omega"],
    ["The Way", "The Truth", "The Life", "The Resurrection", "The True Vine", "The Door", "Morning Star"],
    ["Redeemer", "Savior", "Lion of Judah", "Son of God", "Son of Man", "Holy One", "Rock of Ages"],
    ["Word made flesh", "High Priest", "Cornerstone", "Author of our faith", "Friend of sinners", "Bridegroom"],
    ["God with us", "Living Water", "Faithful and True", "Chief Shepherd", "Hope of Glory", "Yeshua"],
  ],
  gallery: [
    {
      title: "Sunday worship",
      caption: "Main Campus, 10:30 service",
      placeholder: true,
      brief: "Congregation singing, wide shot from the back of the sanctuary.",
    },
    {
      title: "Kids Church",
      caption: "Classroom A, during the sermon",
      placeholder: true,
      brief:
        "Children at a craft table with a teacher, faces turned away or consented.",
    },
    {
      title: "Youth night",
      caption: "North Campus, Fridays",
      placeholder: true,
      brief: "Teenagers in a small circle, warm evening light.",
    },
    {
      title: "Outreach Saturday",
      caption: "Springfield South",
      placeholder: true,
      brief: "Volunteers packing and handing out food bags.",
    },
  ] satisfies GalleryItem[],
  steps: [
    {
      title: "Plan your visit",
      body: "Pick a campus and a time. Tell us you are coming and a greeter will look out for you.",
    },
    {
      title: "Check your kids in",
      body: "At the kids desk you get a tag with a five-character pickup code. Only that code, with you, collects your child.",
    },
    {
      title: "Worship with us",
      body: "About 90 minutes of songs, prayer, and a message from the Bible. Sit anywhere.",
    },
    {
      title: "Stop at the welcome desk",
      body: "Grab a coffee, meet a pastor, and ask anything. No sign-ups required.",
    },
    {
      title: "Find your place",
      body: "When you are ready, join a ministry or a class. Most people start with one.",
    },
  ] satisfies Step[],
  team: {
    title: "The people who will welcome you.",
    note: "Sample names and roles until the church publishes its staff list.",
    people: [
      { name: "Daniel Reyes", role: "Senior Pastor", campus: "All campuses" },
      { name: "Ruth Mendoza", role: "Main Campus Pastor", campus: "Main Campus" },
      { name: "Samuel Ortiz", role: "North Campus Pastor", campus: "North Campus" },
      { name: "Joy Tan", role: "Kids Church Director", campus: "Main Campus" },
    ] as Person[],
  },
  rooms: {
    title: "Rooms for your community.",
    lede: "Neighbors, schools, and families can hire Main Campus rooms when they are free. Every request is checked against the church calendar first.",
    note: "Sample rates. Confirm current rates and dates with the church office.",
    plans: [
      {
        name: "Classroom A",
        capacity: 30,
        ratePerHour: 500,
        bestFor: "Tutoring, small meetings, workshops",
        includes: ["Whiteboard", "TV", "Tables and chairs"],
      },
      {
        name: "Fellowship Hall",
        capacity: 150,
        ratePerHour: 2500,
        bestFor: "Parties, seminars, community meals",
        includes: ["Kitchen", "Tables", "Projector"],
      },
      {
        name: "Sanctuary",
        capacity: 400,
        ratePerHour: 6000,
        bestFor: "Weddings, concerts, graduations",
        includes: ["Sound system", "Projector", "Piano", "Livestream"],
      },
    ] satisfies RoomPlan[],
    action: {
      label: "Ask about dates",
      href: "mailto:hello@cms.local?subject=Room%20hire",
    },
  },
  videos: {
    title: "Sunday messages, wherever you are.",
    lede: "Missed a Sunday, or want to hear it again? The latest message from our YouTube channel, with the three before it.",
    channel: {
      name: "Grace Testament Church",
      handle: "@gtcphofficial",
      url: "https://www.youtube.com/@gtcphofficial",
    },
  },
  closing: {
    title: "Join us this Sunday.",
    primary: { label: "Plan a visit", href: `#${sectionIds.visit}` },
    secondary: {
      label: "Send a prayer request",
      href: "mailto:hello@cms.local?subject=Prayer%20request",
    },
  },
  campuses,
  footer: {
    blurb: "One church meeting in three campuses across Springfield.",
    columns: [
      {
        title: "Visit",
        links: [
          { label: "Service times", href: `#${sectionIds.times}` },
          { label: "Your first Sunday", href: `#${sectionIds.visit}` },
          { label: "Watch", href: `#${sectionIds.watch}` },
        ],
      },
      {
        title: "Get involved",
        links: [
          { label: "Ministries", href: `#${sectionIds.ministries}` },
          { label: "Church life", href: `#${sectionIds.life}` },
          { label: "Room hire", href: `#${sectionIds.rooms}` },
        ],
      },
      {
        title: "Church",
        links: [
          { label: "Our team", href: `#${sectionIds.team}` },
          { label: "Contact", href: `#${sectionIds.contact}` },
          { label: "Staff sign in", href: "/login" },
        ],
      },
    ] satisfies { title: string; links: LandingLink[] }[],
    social: [
      { label: "Facebook", href: "https://www.facebook.com/" },
      { label: "YouTube", href: "https://www.youtube.com/" },
      { label: "Instagram", href: "https://www.instagram.com/" },
    ] satisfies LandingLink[],
    note: "All times are Philippine time (UTC+8).",
    /** Fixed so the page can be prerendered; update each January. */
    copyrightYear: 2026,
  },
};

export const formatPeso = (value: number) =>
  `₱${value.toLocaleString("en-US")}`;
