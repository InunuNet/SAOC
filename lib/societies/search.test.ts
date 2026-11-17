import assert from 'node:assert/strict';
import test from 'node:test';

import { matchSocieties, searchTokens, societyMatches } from './search';
import { matchPages } from '../search-pages';

const societies = [
  { name: 'Natal Orchid Society', slug: 'natal', province: 'KZN', region: 'KwaZulu-Natal', meets: '3rd Saturday of every month, 09:30', venue: 'Northlands Bowling Club - Durban North', description: null },
  { name: 'Highway Orchid Society', slug: 'highway', province: null, region: null, meets: 'Every second Saturday of the month except December, 1:30 PM', venue: 'Pinetown Methodist Church hall', description: null },
  { name: 'Cape Orchid Society', slug: 'cape', province: 'Western Cape', region: 'Cape Town', meets: null, venue: null, description: null },
  { name: 'Orchid Society of Pretoria', slug: 'pretoria', province: 'Gauteng', region: null, meets: null, venue: null, description: null },
  { name: 'Midlands Orchid Society', slug: 'midlands', province: 'KwaZulu-Natal', region: 'Pietermaritzburg', meets: null, venue: null, description: null },
];

test('society search matches existing location text on both search paths', () => {
  assert.deepEqual(matchSocieties(societies, ' Durban ').map((s) => s.slug), ['natal']);
  assert.deepEqual(societies.filter((s) => societyMatches(s, searchTokens('Durban'))).map((s) => s.slug), ['natal']);
  assert.deepEqual(matchSocieties(societies, 'cape').map((s) => s.slug), ['cape']);
  assert.deepEqual(matchSocieties(societies, 'pretoria').map((s) => s.slug), ['pretoria']);
  assert.deepEqual(matchSocieties(societies, 'pietermaritzburg').map((s) => s.slug), ['midlands']);
  assert.deepEqual(matchSocieties(societies, 'Nátal  DÚRBAN').map((s) => s.slug), ['natal']);
  assert.deepEqual(matchSocieties(societies, 'Pinetown').map((s) => s.slug), ['highway']);
  assert.deepEqual(matchSocieties(societies, 'Durban Cape'), []);
  assert.deepEqual(matchSocieties(societies, '   '), []);
});

test('page search uses existing navigation labels and routes', () => {
  assert.ok(matchPages('judging').some((page) => page.label === 'Judging & Awards' && page.href === '/judging'));
  assert.ok(matchPages('tickets').some((page) => page.label === 'Tickets' && page.href.endsWith('/tickets')));
  assert.ok(!matchPages('past shows').some((page) => page.label === 'Past shows'));
  assert.ok(matchPages('past shows', true).some((page) => page.label === 'Past shows'));
});
