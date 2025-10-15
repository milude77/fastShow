exports.up = function(knex) {
  return knex.schema.createTable('group_members', function (table) {
    table.string('group_id').notNullable();
    table.string('user_id').notNullable();
    table.string('user_name').notNullable();
    table.timestamps(true, true);

    table.primary(['group_id', 'user_id']); 

    table.foreign('group_id').references('id').inTable('groups').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE'); // User deletion cascades to remove them from groups
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('group_members');
};
