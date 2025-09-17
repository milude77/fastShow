exports.up = function(knex) {
  return knex.schema.createTable('friendships', function(table) {
    table.increments('id').primary();
    
    table.string('user_id').notNullable();
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    
    table.string('friend_id').notNullable();
    table.foreign('friend_id').references('id').inTable('users').onDelete('CASCADE');
    
    table.string('status').notNullable().defaultTo('pending'); // e.g., pending, accepted, blocked
    
    table.timestamps(true, true);
    
    // Ensure a user cannot be friends with themselves
    table.check('user_id <> friend_id');
    
    // Ensure the friendship is unique
    table.unique(['user_id', 'friend_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('friendships');
};
