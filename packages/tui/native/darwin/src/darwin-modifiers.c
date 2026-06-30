#include <CoreGraphics/CoreGraphics.h>
#include <dlfcn.h>
#include <stdbool.h>
#include <stddef.h>
#include <string.h>

#define NAAIRIS_AUTO_LENGTH ((size_t)-1)

typedef void* naairis_env;
typedef void* naairis_value;
typedef void* naairis_callback_info;
typedef naairis_value (*naairis_callback)(naairis_env, naairis_callback_info);
typedef int (*naairis_create_function_fn)(naairis_env, const char*, size_t, naairis_callback, void*, naairis_value*);
typedef int (*naairis_set_named_property_fn)(naairis_env, naairis_value, const char*, naairis_value);
typedef int (*naairis_get_boolean_fn)(naairis_env, bool, naairis_value*);
typedef int (*naairis_get_cb_info_fn)(naairis_env, naairis_callback_info, size_t*, naairis_value*, naairis_value*, void**);
typedef int (*naairis_get_value_string_utf8_fn)(naairis_env, naairis_value, char*, size_t, size_t*);

static void* node_symbol(const char* name) {
    return dlsym(RTLD_DEFAULT, name);
}

static CGEventFlags modifier_mask_for_name(const char* name) {
    if (strcmp(name, "shift") == 0) return kCGEventFlagMaskShift;
    if (strcmp(name, "command") == 0) return kCGEventFlagMaskCommand;
    if (strcmp(name, "control") == 0) return kCGEventFlagMaskControl;
    if (strcmp(name, "option") == 0) return kCGEventFlagMaskAlternate;
    return 0;
}

static naairis_value is_modifier_pressed(naairis_env env, naairis_callback_info info) {
    naairis_get_cb_info_fn naairis_get_cb_info = (naairis_get_cb_info_fn)node_symbol("naairis_get_cb_info");
    naairis_get_value_string_utf8_fn naairis_get_value_string_utf8 = (naairis_get_value_string_utf8_fn)node_symbol("naairis_get_value_string_utf8");
    naairis_get_boolean_fn naairis_get_boolean = (naairis_get_boolean_fn)node_symbol("naairis_get_boolean");

    bool pressed = false;
    if (naairis_get_cb_info && naairis_get_value_string_utf8) {
        size_t argc = 1;
        naairis_value args[1] = {0};
        if (naairis_get_cb_info(env, info, &argc, args, 0, 0) == 0 && argc >= 1 && args[0]) {
            char name[16] = {0};
            size_t copied = 0;
            if (naairis_get_value_string_utf8(env, args[0], name, sizeof(name), &copied) == 0) {
                CGEventFlags mask = modifier_mask_for_name(name);
                if (mask != 0) {
                    CGEventFlags flags = CGEventSourceFlagsState(kCGEventSourceStateCombinedSessionState);
                    pressed = (flags & mask) != 0;
                }
            }
        }
    }

    naairis_value result = 0;
    if (naairis_get_boolean) naairis_get_boolean(env, pressed, &result);
    return result;
}

__attribute__((visibility("default"))) naairis_value naairis_register_module_v1(naairis_env env, naairis_value exports) {
    naairis_create_function_fn naairis_create_function = (naairis_create_function_fn)node_symbol("naairis_create_function");
    naairis_set_named_property_fn naairis_set_named_property = (naairis_set_named_property_fn)node_symbol("naairis_set_named_property");

    naairis_value fn = 0;
    if (naairis_create_function &&
        naairis_set_named_property &&
        naairis_create_function(env, "isModifierPressed", NAAIRIS_AUTO_LENGTH, is_modifier_pressed, 0, &fn) == 0) {
        naairis_set_named_property(env, exports, "isModifierPressed", fn);
    }

    return exports;
}
