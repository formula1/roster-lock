

function main()
  -- count each selected item
  local maximum = 0
  local map = {}
  for _, user in ipairs(users) do
    local chosen = selection[user][1]
    local newValue = (map[chosen.id] or 0) + 1
    map[chosen.id] = newValue
    if newValue > maximum then maximum = newValue end
  end

  log("map:", map);

  -- get all maximum
  local equalKeys = {}
  for k, v in pairs(map) do
    if v == maximum then
      table.insert(equalKeys, k)
    end
  end

  -- if only one maximum, return it
  if #equalKeys == 1 then
    return {{ id = equalKeys[1], required = {} }}
  end
  -- if multiple, choose one at random
  local index = math.random(1, #equalKeys)
  return {{ id = equalKeys[index], required = {} }}
end
