exports.up = function(knex) {
  return knex.schema.createTable('group_messages', function (table) {
    table.increments('id').primary();
    table.string('group_id').notNullable();
    table.string('sender_id').notNullable();
    table.text('content').notNullable();
    table.timestamp('timestamp').defaultTo(knex.fn.now());

    // File-related fields (copied from messages table migration)
    table.string('message_type', 50).defaultTo('text'); // 'text' or 'file'
    table.string('file_name', 255).nullable();
    table.string('file_path', 500).nullable();
    table.string('file_url', 500).nullable();
    table.bigInteger('file_size').nullable();
    table.string('mime_type', 100).nullable();
    table.string('file_id', 100).nullable();

    table.timestamps(true, true); // created_at and updated_at

    table.foreign('group_id').references('id').inTable('groups').onDelete('CASCADE');
    table.foreign('sender_id').references('id').inTable('users').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('group_messages');
};
