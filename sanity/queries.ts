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

export const societyBySlugQuery = defineQuery(`
  *[_type == "society" && slug.current == $slug][0]{
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

export const societySlugsQuery = defineQuery(`
  *[_type == "society" && defined(slug.current)]{ "slug": slug.current }
`);

export const showClassesQuery = defineQuery(`
  *[_type == "showClass"] | order(order asc){
    _id,
    code,
    name,
    description
  }
`);

export const pastShowsQuery = defineQuery(`
  *[_type == "show" && status == "past"] | order(year desc){
    _id,
    title,
    "slug": slug.current,
    year,
    location,
    entries,
    exhibitors,
    awards
  }
`);

export const judgingPageQuery = defineQuery(`
  *[_type == "judgingPage"][0]{
    title,
    intro,
    howItWorks,
    stats,
    becomingAJudge,
    showPublicDirectory,
    "judges": judges[]->{
      name,
      region,
      accreditedSince,
      photo
    }
  }
`);

export const contactPageQuery = defineQuery(`
  *[_type == "contactPage"][0]{
    title,
    directContacts[]{
      name,
      role,
      email
    }
  }
`);
