exports.up = function(knex) {
  return knex.schema.createTable('group_message_read_status', function (table) {
    table.integer('group_message_id').notNullable();
    table.string('user_id').notNullable();
    table.string('status', 50).defaultTo('delivered');
    table.timestamp('timestamp').defaultTo(knex.fn.now());

    table.primary(['group_message_id', 'user_id']); // Composite primary key to ensure unique status per message per user

    table.foreign('group_message_id').references('id').inTable('group_messages').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('group_message_read_status');
};
