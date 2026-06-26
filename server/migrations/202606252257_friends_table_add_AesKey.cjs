exports.up = async (knex) => {
    return knex.schema.alterTable('friendships', (table) => {
        table.text('aes_key');
    });
};

exports.down = async (knex) => {
    return knex.schema.alterTable('friendships', (table) => {
        table.dropColumn('aes_key');
    });
};