exports.up = function(knex) {
    return knex.schema.createTable('user_event', function(table) {
        table.increments('id').primary();
        table.string('user_id').unsigned().references('id').inTable('users');
        table.string('action')
        table.jsonb('event_data');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.index(['user_id', 'id']);
    });
}

exports.down = function(knex) {
    return knex.schema.dropTable('user_event');
}