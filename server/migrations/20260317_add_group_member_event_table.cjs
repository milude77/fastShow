exports.up = function (knex) {
    return knex.schema.createTable('group_member_event', function (table) {
        table.increments('id').primary();
        table.string('group_id').unsigned().references('id').inTable('groups').onDelete('CASCADE');
        table.string('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
        table.jsonb('event_data');
        table.string('action')
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.index(['group_id', 'id']);
    })
}

exports.down = function (knex) {
    return knex.schema.dropTable('group_member_event');
}