const normalize = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

function purokProfileWhere(purok) {
  const name = String(purok || '').trim();
  if (!name) return { userId: { in: [] } };
  // The address clause only narrows candidates; always apply the exact matcher.
  return { OR: [
    { purok: { equals: name, mode: 'insensitive' } },
    { AND: [{ purok: null }, { address: { contains: name, mode: 'insensitive' } }] },
  ] };
}

function belongsToPurok(profile, purok) {
  const expected = normalize(purok);
  if (!expected) return false;
  if (profile.purok) return normalize(profile.purok) === expected;
  const address = normalize(profile.address);
  const numbered = [...new Set(address.match(/\bpurok\s+\d+\b/g) || [])];
  if (/^purok \d+$/.test(expected)) return numbered.length === 1 && numbered[0] === expected;
  const escaped = expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(?:^|[^a-z0-9])' + escaped + '(?=$|[^a-z0-9-])', 'i').test(address);
}

async function userIdsForPurok(purok, client) {
  if (!normalize(purok)) return [];
  const profiles = await client.verificationProfile.findMany({ where: purokProfileWhere(purok), select: { userId: true, purok: true, address: true } });
  return profiles.filter(p => belongsToPurok(p, purok)).map(p => p.userId).filter(Boolean);
}

module.exports = { purokProfileWhere, belongsToPurok, userIdsForPurok };
