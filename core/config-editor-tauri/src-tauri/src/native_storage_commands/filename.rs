use regex::Regex;
use std::sync::LazyLock;

// Invalid characters for filenames: <>:"/\|?* and control characters (0x00-0x1F)
static INVALID_CHARS: LazyLock<Regex> =
  LazyLock::new(|| Regex::new(r#"[<>:"/\\|?*\x00-\x1F]"#).unwrap());

const ESCAPE_CHAR: char = '+';

/// Escapes a single character to its hex representation with the escape character prefix
fn escape_char(ch: char) -> String {
  format!("{}{:02x}", ESCAPE_CHAR, ch as u32)
}

pub fn raw_key_to_filename(key: &str) -> Result<String, String> {
  if key.is_empty() {
    return Err("Key cannot be empty".to_string());
  }

  let mut result = String::new();

  for ch in key.chars() {
    if ch == ESCAPE_CHAR {
      result.push(ESCAPE_CHAR);
      result.push(ESCAPE_CHAR);
    } else if INVALID_CHARS.is_match(&ch.to_string()) {
      result.push_str(&escape_char(ch));
    } else {
      result.push(ch);
    }
  }

  Ok(result)
}

pub fn raw_filename_to_key(filename: &str) -> Result<String, String> {
  let mut result = String::new();
  let chars: Vec<char> = filename.chars().collect();
  let mut i = 0;

  while i < chars.len() {
    let ch = chars[i];

    if ch != ESCAPE_CHAR {
      result.push(ch);
      i += 1;
      continue;
    }

    if i + 1 >= chars.len() {
      return Err(format!(
        "Invalid escape sequence: lone escape character at end of filename at position {}",
        i
      ));
    }

    let next = chars[i + 1];
    if next == ESCAPE_CHAR {
      // Double escape char means a literal escape char
      result.push(ESCAPE_CHAR);
      i += 2;
      continue;
    }

    if i + 2 >= chars.len() {
      return Err(format!(
        "Invalid escape sequence: incomplete hex sequence at position {}",
        i
      ));
    }

    // Try to parse hex sequence
    let hex_str: String = chars[i + 1..i + 3].iter().collect();

    match u32::from_str_radix(&hex_str, 16) {
      Err(_) => {
        return Err(format!(
          "Invalid hex sequence: '{}' is not valid hexadecimal at position {}",
          hex_str, i
        ));
      }
      Ok(char_code) => match char::from_u32(char_code) {
        None => {
          return Err(format!("Invalid hex sequence: '{}' does not represent a valid Unicode character at position {}", hex_str, i));
        }
        Some(decoded_char) => {
          result.push(decoded_char);
          i += 3;
        }
      },
    }
  }

  Ok(result)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_key_to_filename_basic() {
    assert_eq!(key_to_filename("hello"), "hello");
    assert_eq!(key_to_filename("hello world"), "hello world");
  }

  #[test]
  fn test_key_to_filename_invalid_chars() {
    assert_eq!(key_to_filename("hello/world"), "hello+2fworld");
    assert_eq!(key_to_filename("file<name>"), "file+3cname+3e");
    assert_eq!(key_to_filename("path\\to\\file"), "path+5cto+5cfile");
    assert_eq!(key_to_filename("file:name"), "file+3aname");
    assert_eq!(key_to_filename("file\"name"), "file+22name");
    assert_eq!(key_to_filename("file|name"), "file+7cname");
    assert_eq!(key_to_filename("file?name"), "file+3fname");
    assert_eq!(key_to_filename("file*name"), "file+2aname");
  }

  #[test]
  fn test_key_to_filename_escape_char() {
    assert_eq!(key_to_filename("test+file"), "test++file");
    assert_eq!(key_to_filename("++test++"), "++++test++++");
  }

  #[test]
  fn test_key_to_filename_control_chars() {
    assert_eq!(key_to_filename("test\x00file"), "test+00file");
    assert_eq!(key_to_filename("test\x1ffile"), "test+1ffile");
  }

  #[test]
  fn test_filename_to_key_basic() {
    assert_eq!(filename_to_key("hello"), "hello");
    assert_eq!(filename_to_key("hello world"), "hello world");
  }

  #[test]
  fn test_filename_to_key_escaped_chars() {
    assert_eq!(filename_to_key("hello+2fworld"), "hello/world");
    assert_eq!(filename_to_key("file+3cname+3e"), "file<name>");
    assert_eq!(filename_to_key("path+5cto+5cfile"), "path\\to\\file");
    assert_eq!(filename_to_key("file+3aname"), "file:name");
    assert_eq!(filename_to_key("file+22name"), "file\"name");
    assert_eq!(filename_to_key("file+7cname"), "file|name");
    assert_eq!(filename_to_key("file+3fname"), "file?name");
    assert_eq!(filename_to_key("file+2aname"), "file*name");
  }

  #[test]
  fn test_filename_to_key_escape_char() {
    assert_eq!(filename_to_key("test++file"), "test+file");
    assert_eq!(filename_to_key("++++++test++++++"), "+++test+++");
  }

  #[test]
  fn test_filename_to_key_control_chars() {
    assert_eq!(filename_to_key("test+00file"), "test\x00file");
    assert_eq!(filename_to_key("test+1ffile"), "test\x1ffile");
  }

  #[test]
  fn test_roundtrip() {
    let test_cases = vec![
      "hello/world",
      "file<name>",
      "path\\to\\file",
      "file:name",
      "file\"name",
      "file|name",
      "file?name",
      "file*name",
      "test+file",
      "++test++",
      "test\x00file",
      "test\x1ffile",
      "normal_filename",
      "",
    ];

    for test_case in test_cases {
      let filename = key_to_filename(test_case);
      let recovered = filename_to_key(&filename);
      assert_eq!(recovered, test_case, "Roundtrip failed for: {}", test_case);
    }
  }

  #[test]
  fn test_invalid_hex_sequences() {
    // Test cases where hex parsing should fail and characters should be treated literally
    assert_eq!(filename_to_key("test+ggfile"), "test+ggfile");
    assert_eq!(filename_to_key("test+g"), "test+g");
    assert_eq!(filename_to_key("test+"), "test+");
  }
}
