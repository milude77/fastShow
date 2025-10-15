exports.up = function(knex) {
  return knex.schema.createTable('groups', function (table) {
    table.string('id').primary(); 
    table.string('name', 255).notNullable();
    table.timestamps(true, true); // created_at and updated_at
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('groups');
};
