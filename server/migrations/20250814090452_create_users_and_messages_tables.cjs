exports.up = function(knex) {
  return knex.schema
    .createTable('users', function (table) {
      table.string('id').primary();
      table.string('username', 255).notNullable(); // 移除 unique 约束
      table.string('password_hash', 255); // For future authentication
      table.timestamps(true, true); // created_at and updated_at
    })
    .createTable('messages', function (table) {
      table.increments('id').primary();
      table.string('sender_id').unsigned().notNullable();
      table.string('receiver_id').unsigned().nullable(); // Null for group messages
      table.string('room_id', 255).notNullable(); // 'public' or specific room ID
      table.text('content').notNullable();
      table.timestamp('timestamp').defaultTo(knex.fn.now());
      table.string('status', 50).defaultTo('sent'); // e.g., 'sent', 'delivered', 'read'
      table.timestamps(true, true); // created_at and updated_at

      table.foreign('sender_id').references('id').inTable('users').onDelete('CASCADE');
      // receiver_id can be null, so no foreign key constraint for it directly
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('messages')
    .dropTableIfExists('users');
};
