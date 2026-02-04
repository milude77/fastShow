/**
 * 使用 Knex.js 语法添加版本控制和删除状态字段到 friendships 表和 groups 表
 * @param {import('knex').Knex} knex
 */

exports.up = async function(knex) {
  // 为 friendships 表添加 version 和 is_deleted 字段
  await knex.schema.table('friendships', table => {
    table.integer('version').notNullable().defaultTo(1);
    table.boolean('is_deleted').notNullable().defaultTo(false);
  });

  // 为 groups 表添加 is_exit 和 version 字段
  await knex.schema.table('groups', table => {
    table.boolean('is_exit').notNullable().defaultTo(false);
    table.integer('version').notNullable().defaultTo(1);
  });

  // 创建索引
  await knex.schema.alterTable('friendships', table => {
    table.index(['user_id'], 'friendships_user_id_idx');
    table.index(['friend_id'], 'friendships_friend_id_idx');
    table.index(['version'], 'friendships_version_idx');
  });

  await knex.schema.alterTable('groups', table => {
    table.index(['version'], 'groups_version_idx');
  });
};

exports.down = async function(knex) {
  // 删除索引
  await knex.schema.alterTable('friendships', table => {
    table.dropIndex(['user_id'], 'friendships_user_id_idx');
    table.dropIndex(['friend_id'], 'friendships_friend_id_idx');
    table.dropIndex(['version'], 'friendships_version_idx');
  });

  await knex.schema.alterTable('groups', table => {
    table.dropIndex(['version'], 'groups_version_idx');
  });

  // 从表中删除字段
  await knex.schema.table('friendships', table => {
    table.dropColumn('version');
    table.dropColumn('is_deleted');
  });

  await knex.schema.table('groups', table => {
    table.dropColumn('is_exit');
    table.dropColumn('version');
  });
};