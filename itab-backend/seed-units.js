/**
 * Seed Units Script
 * Seeds realistic units into the apartments and commercial property on the live site.
 * Run: DATABASE_URL=<external_url> node seed-units.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function seed() {
  console.log('\n🏢 Seeding property units on live DB...\n');

  // Get all apartment and commercial properties
  const props = await pool.query(
    `SELECT id, title, rent_price FROM properties WHERE type IN ('apartment','commercial') ORDER BY title`
  );

  if (!props.rows.length) {
    console.log('No apartment/commercial properties found.');
    await pool.end(); return;
  }

  for (const prop of props.rows) {
    // Check if units already exist
    const existing = await pool.query('SELECT COUNT(*) FROM property_units WHERE property_id=$1', [prop.id]);
    if (parseInt(existing.rows[0].count) > 0) {
      console.log(`  ⏭  ${prop.title} — units already exist`);
      continue;
    }

    console.log(`  🏗  Adding units to: ${prop.title}`);

    // Build units based on property type and rent
    const units = buildUnits(prop);

    for (const unit of units) {
      await pool.query(
        `INSERT INTO property_units
           (id, property_id, unit_name, description, floor_number, bedrooms, bathrooms,
            square_footage, rent_price, deposit, photos, amenities, status, available_from, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15)`,
        [
          uuidv4(), prop.id, unit.unitName, unit.description,
          unit.floorNumber, unit.bedrooms, unit.bathrooms,
          unit.squareFootage, unit.rentPrice, unit.deposit,
          JSON.stringify(unit.photos),
          JSON.stringify(unit.amenities),
          unit.status, unit.availableFrom, unit.sortOrder,
        ]
      );
      console.log(`     ✅ ${unit.unitName} — UGX ${unit.rentPrice.toLocaleString()}/mo (${unit.status})`);
    }

    // Mark property as having units
    await pool.query('UPDATE properties SET has_units=true WHERE id=$1', [prop.id]);
  }

  console.log('\n✅ Unit seeding complete!\n');
  await pool.end();
}

function buildUnits(prop) {
  const baseRent = Math.round(prop.rent_price / 4) || 250000;
  const isCommercial = prop.title.toLowerCase().includes('commercial') ||
                       prop.title.toLowerCase().includes('nakasero') ||
                       prop.title.toLowerCase().includes('shop');

  if (isCommercial) {
    return [
      {
        unitName: 'Ground Floor Shop A', description: 'Street-facing retail space with high foot traffic. Suitable for clothing, food, pharmacy.',
        floorNumber: 0, bedrooms: 0, bathrooms: 1, squareFootage: 45,
        rentPrice: Math.round(baseRent * 1.4), deposit: Math.round(baseRent * 2.8),
        photos: ['https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800'],
        amenities: ['electricity', 'water', 'security', 'cctv', 'wifi'],
        status: 'available', availableFrom: '2026-07-01', sortOrder: 1,
      },
      {
        unitName: 'Ground Floor Shop B', description: 'Corner unit with extra visibility. Ideal for a cafe, bakery, or tech shop.',
        floorNumber: 0, bedrooms: 0, bathrooms: 1, squareFootage: 38,
        rentPrice: Math.round(baseRent * 1.2), deposit: Math.round(baseRent * 2.4),
        photos: ['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800'],
        amenities: ['electricity', 'water', 'security', 'parking'],
        status: 'rented', availableFrom: null, sortOrder: 2,
      },
      {
        unitName: 'First Floor Office A', description: 'Spacious open-plan office space. Includes private toilet. Perfect for SMEs, NGOs, law firms.',
        floorNumber: 1, bedrooms: 0, bathrooms: 1, squareFootage: 80,
        rentPrice: Math.round(baseRent * 1.6), deposit: Math.round(baseRent * 3.2),
        photos: ['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800'],
        amenities: ['electricity', 'water', 'security', 'wifi', 'generator', 'air_conditioning'],
        status: 'available', availableFrom: '2026-07-15', sortOrder: 3,
      },
      {
        unitName: 'First Floor Office B', description: 'Partitioned office with reception area and 2 private rooms.',
        floorNumber: 1, bedrooms: 0, bathrooms: 1, squareFootage: 65,
        rentPrice: Math.round(baseRent * 1.3), deposit: Math.round(baseRent * 2.6),
        photos: ['https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800'],
        amenities: ['electricity', 'water', 'security', 'wifi'],
        status: 'available', availableFrom: '2026-08-01', sortOrder: 4,
      },
      {
        unitName: 'Second Floor Penthouse Suite', description: 'Premium office with panoramic city views. Fully furnished, air-conditioned boardroom included.',
        floorNumber: 2, bedrooms: 0, bathrooms: 2, squareFootage: 120,
        rentPrice: Math.round(baseRent * 2.2), deposit: Math.round(baseRent * 4.4),
        photos: ['https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800'],
        amenities: ['electricity', 'water', 'security', 'wifi', 'generator', 'air_conditioning', 'elevator', 'cctv'],
        status: 'available', availableFrom: '2026-07-01', sortOrder: 5,
      },
    ];
  }

  // Apartment units
  return [
    {
      unitName: 'Unit 1A — Ground Floor', description: 'Bright ground-floor apartment with garden access. No steps — ideal for elderly or young families.',
      floorNumber: 0, bedrooms: 1, bathrooms: 1, squareFootage: 55,
      rentPrice: Math.round(baseRent * 0.85), deposit: Math.round(baseRent * 1.7),
      photos: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800'],
      amenities: ['water', 'electricity', 'security', 'parking', 'garden'],
      status: 'rented', availableFrom: null, sortOrder: 1,
    },
    {
      unitName: 'Unit 1B — Ground Floor', description: 'Compact but well-laid-out ground floor unit. Recently renovated kitchen and bathroom.',
      floorNumber: 0, bedrooms: 1, bathrooms: 1, squareFootage: 50,
      rentPrice: Math.round(baseRent * 0.80), deposit: Math.round(baseRent * 1.6),
      photos: ['https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=800'],
      amenities: ['water', 'electricity', 'security'],
      status: 'available', availableFrom: '2026-07-01', sortOrder: 2,
    },
    {
      unitName: 'Unit 2A — First Floor', description: 'Spacious 2-bedroom unit with balcony and city views. Full kitchen with modern fittings.',
      floorNumber: 1, bedrooms: 2, bathrooms: 1, squareFootage: 75,
      rentPrice: Math.round(baseRent * 1.15), deposit: Math.round(baseRent * 2.3),
      photos: ['https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800'],
      amenities: ['water', 'electricity', 'security', 'wifi', 'balcony'],
      status: 'available', availableFrom: '2026-07-01', sortOrder: 3,
    },
    {
      unitName: 'Unit 2B — First Floor', description: 'Fully furnished 2-bedroom apartment. Includes fridge, sofa set, and bed frames.',
      floorNumber: 1, bedrooms: 2, bathrooms: 2, squareFootage: 80,
      rentPrice: Math.round(baseRent * 1.3), deposit: Math.round(baseRent * 2.6),
      photos: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800'],
      amenities: ['water', 'electricity', 'security', 'wifi', 'furnished', 'parking'],
      status: 'available', availableFrom: '2026-07-15', sortOrder: 4,
    },
    {
      unitName: 'Unit 3A — Top Floor (Penthouse)', description: 'Premium top-floor unit with panoramic views, 3 bedrooms and en-suite master. Must see.',
      floorNumber: 2, bedrooms: 3, bathrooms: 2, squareFootage: 110,
      rentPrice: Math.round(baseRent * 1.8), deposit: Math.round(baseRent * 3.6),
      photos: ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800'],
      amenities: ['water', 'electricity', 'security', 'wifi', 'furnished', 'parking', 'balcony', 'gym'],
      status: 'available', availableFrom: '2026-07-01', sortOrder: 5,
    },
    {
      unitName: 'Unit 3B — Top Floor', description: '2-bedroom top floor unit sharing the penthouse amenities. Quiet and airy.',
      floorNumber: 2, bedrooms: 2, bathrooms: 1, squareFootage: 70,
      rentPrice: Math.round(baseRent * 1.1), deposit: Math.round(baseRent * 2.2),
      photos: ['https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800'],
      amenities: ['water', 'electricity', 'security', 'parking', 'balcony'],
      status: 'rented', availableFrom: null, sortOrder: 6,
    },
  ];
}

seed().catch(async e => {
  console.error('❌ Seed failed:', e.message);
  await pool.end();
  process.exit(1);
});
