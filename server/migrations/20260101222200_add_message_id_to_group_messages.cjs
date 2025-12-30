exports.up = function(knex) {
  return knex.schema.alterTable('group_messages', function(table) {
    table.string('message_id', 255).unique();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('group_messages', function(table) {
    table.dropColumn('message_id');
  });
};
