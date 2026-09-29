package expo.modules.tvmedia

import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteCursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteProgram
import expo.modules.kotlin.Promise
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors

/**
 * The library database (D-121): Android's own SQLite, so the app carries no database library. JavaScript sends SQL
 * with parameters as JSON and gets rows back as JSON; all library logic stays in @iptv/shared (`sqlLibrary.ts`).
 *
 * - Writes run on one thread and reads on another; with write-ahead logging a list is not held up by an update being
 *   saved. Each call is one transaction, begun and ended on its thread (Android ties transactions to threads).
 * - Characters outside the BMP (emoji) are written as JSON escapes both ways: Expo hands text across as modified
 *   UTF-8, which would garble them (see [JsonArraySplitter]).
 */
internal object LibraryDb {
  private const val NAME = "library.db"
  private val writer = Executors.newSingleThreadExecutor { Thread(it, "library-db-write") }
  private val reader = Executors.newSingleThreadExecutor { Thread(it, "library-db-read") }

  @Volatile private var db: SQLiteDatabase? = null

  private fun open(context: Context): SQLiteDatabase =
    db ?: synchronized(this) {
      db ?: SQLiteDatabase.openOrCreateDatabase(context.getDatabasePath(NAME).apply { parentFile?.mkdirs() }, null).also {
        it.enableWriteAheadLogging()
        db = it
      }
    }

  /** `statements`: `[{ sql, rows? }]`; each statement runs once per row of parameters (once without rows). */
  fun run(context: Context, statements: String, promise: Promise) {
    writer.execute {
      try {
        val database = open(context)
        val list = JSONArray(statements)
        database.beginTransaction()
        try {
          for (i in 0 until list.length()) {
            val statement = list.getJSONObject(i)
            database.compileStatement(statement.getString("sql")).use { compiled ->
              val rows = statement.optJSONArray("rows")
              if (rows == null) compiled.execute()
              else for (r in 0 until rows.length()) {
                compiled.clearBindings()
                bind(compiled, rows.getJSONArray(r))
                compiled.execute()
              }
            }
          }
          database.setTransactionSuccessful()
        } finally {
          database.endTransaction()
        }
        promise.resolve(null)
      } catch (error: Throwable) {
        promise.reject("ERR_LIBRARY_DB", error.message ?: error.toString(), error)
      }
    }
  }

  /** Rows as a JSON array of arrays. Parameters are bound with their types (numbers stay numbers). */
  fun query(context: Context, sql: String, params: String, promise: Promise) {
    reader.execute {
      try {
        val values = JSONArray(params)
        val cursor = open(context).rawQueryWithFactory(
          { _, driver, editTable, query ->
            bind(query, values)
            SQLiteCursor(driver, editTable, query)
          },
          sql,
          null,
          // No table to edit through the cursor (the parameter may not be null).
          "",
        )
        promise.resolve(cursor.use { toJson(it) })
      } catch (error: Throwable) {
        promise.reject("ERR_LIBRARY_DB", error.message ?: error.toString(), error)
      }
    }
  }

  private fun bind(program: SQLiteProgram, values: JSONArray) {
    for (i in 0 until values.length()) {
      val index = i + 1
      when (val value = values.get(i)) {
        JSONObject.NULL -> program.bindNull(index)
        is Int -> program.bindLong(index, value.toLong())
        is Long -> program.bindLong(index, value)
        is Number -> program.bindDouble(index, value.toDouble())
        is Boolean -> program.bindLong(index, if (value) 1 else 0)
        else -> program.bindString(index, value.toString())
      }
    }
  }

  private fun toJson(cursor: Cursor): String {
    val out = StringBuilder()
    out.append('[')
    var first = true
    while (cursor.moveToNext()) {
      if (!first) out.append(',')
      first = false
      out.append('[')
      for (column in 0 until cursor.columnCount) {
        if (column > 0) out.append(',')
        when (cursor.getType(column)) {
          Cursor.FIELD_TYPE_NULL -> out.append("null")
          Cursor.FIELD_TYPE_INTEGER -> out.append(cursor.getLong(column))
          Cursor.FIELD_TYPE_FLOAT -> {
            val value = cursor.getDouble(column)
            if (value.isNaN() || value.isInfinite()) out.append("null") else out.append(value)
          }
          Cursor.FIELD_TYPE_STRING -> quote(out, cursor.getString(column))
          else -> out.append("null")
        }
      }
      out.append(']')
    }
    return out.append(']').toString()
  }

  private const val HEX = "0123456789abcdef"

  private fun quote(out: StringBuilder, text: String) {
    out.append('"')
    for (c in text) {
      when {
        c == '"' -> out.append("\\\"")
        c == '\\' -> out.append("\\\\")
        c < ' ' || c in '\uD800'..'\uDFFF' || c == ' ' || c == ' ' ->
          out.append("\\u").append(HEX[c.code shr 12 and 15]).append(HEX[c.code shr 8 and 15])
            .append(HEX[c.code shr 4 and 15]).append(HEX[c.code and 15])
        else -> out.append(c)
      }
    }
    out.append('"')
  }
}
