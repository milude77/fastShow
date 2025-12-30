exports.up = function (knex) {
  return knex.schema.table('messages', function (table) {
    table.string('message_id', 64).unique().index();
  });
};

exports.down = function (knex) {
  return knex.schema.table('messages', function (table) {
    table.dropColumn('message_id');
  });
};
