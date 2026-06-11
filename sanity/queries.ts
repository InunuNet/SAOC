import { defineQuery } from 'next-sanity';

export const homePageQuery = defineQuery(`
  *[_type == "homePage"][0]{
    title,
    heroImages,
    missionText,
    countdownDate
  }
`);

export const societyListQuery = defineQuery(`
  *[_type == "society"] | order(name asc){
    _id,
    name,
    "slug": slug.current,
    province,
    region,
    founded,
    meets,
    venue,
    memberCount,
    description,
    logo,
    website,
    markBadge
  }
`);

export const nationalShowQuery = defineQuery(`
  *[_type == "nationalShow"][0]{
    title,
    showDate,
    location,
    hero,
    countdownDate,
    exhibitorStages
  }
`);

export const upcomingEventsQuery = defineQuery(`
  *[_type == "societyEvent" && date >= now()] | order(date asc){
    _id,
    title,
    "slug": slug.current,
    date,
    endDate,
    kind,
    description,
    venue,
    location,
    isFeatured,
    "hostSociety": hostSociety->{ _id, name, "slug": slug.current }
  }
`);

export const partnersQuery = defineQuery(`
  *[_type == "sponsor" && active == true] | order(tier asc, name asc){
    _id,
    name,
    tier,
    logo,
    website,
    description
  }
`);

export const aboutPageQuery = defineQuery(`
  *[_type == "aboutPage"][0]{
    title,
    pillars,
    timelineNodes,
    boardIntroText
  }
`);

export const boardMembersQuery = defineQuery(`
  *[_type == "boardMember"] | order(order asc){
    _id,
    name,
    role,
    email,
    photo,
    order
  }
`);
