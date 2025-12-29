
exports.up = function(knex) {
  return knex.schema.createTable('group_invitations', function(table) {
    table.string('id').primary();
    table.string('group_id').notNullable().index();
    table.string('inviting_user_id').notNullable().index();
    table.string('invited_user_id').notNullable().index();
    table.string('status').notNullable().defaultTo('pending'); // 'pending', 'accepted', 'rejected'
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Foreign key constraints
    table.foreign('group_id').references('id').inTable('groups').onDelete('CASCADE');
    table.foreign('inviting_user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('invited_user_id').references('id').inTable('users').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('group_invitations');
};
