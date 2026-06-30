#include <windows.h>

#ifndef ENABLE_VIRTUAL_TERMINAL_INPUT
#define ENABLE_VIRTUAL_TERMINAL_INPUT 0x0200
#endif

#define NAAIRIS_AUTO_LENGTH ((unsigned long long)-1)

typedef void* naairis_env;
typedef void* naairis_value;
typedef void* naairis_callback_info;
typedef naairis_value (__cdecl *naairis_callback)(naairis_env, naairis_callback_info);
typedef int (__cdecl *naairis_create_function_fn)(naairis_env, const char*, unsigned long long, naairis_callback, void*, naairis_value*);
typedef int (__cdecl *naairis_set_named_property_fn)(naairis_env, naairis_value, const char*, naairis_value);
typedef int (__cdecl *naairis_get_boolean_fn)(naairis_env, int, naairis_value*);

static void* node_symbol(const char* name) {
    HMODULE module = GetModuleHandleA(0);
    void* proc = module ? (void*)GetProcAddress(module, name) : 0;
    if (proc) return proc;

    module = GetModuleHandleA("node.dll");
    return module ? (void*)GetProcAddress(module, name) : 0;
}

static naairis_value __cdecl enable_virtual_terminal_input(naairis_env env, naairis_callback_info info) {
    (void)info;

    HANDLE handle = GetStdHandle(STD_INPUT_HANDLE);
    DWORD mode = 0;
    int enabled = handle != INVALID_HANDLE_VALUE &&
        GetConsoleMode(handle, &mode) &&
        SetConsoleMode(handle, mode | ENABLE_VIRTUAL_TERMINAL_INPUT);

    naairis_get_boolean_fn naairis_get_boolean = (naairis_get_boolean_fn)node_symbol("naairis_get_boolean");
    naairis_value result = 0;
    if (naairis_get_boolean) naairis_get_boolean(env, enabled, &result);
    return result;
}

__declspec(dllexport) naairis_value __cdecl naairis_register_module_v1(naairis_env env, naairis_value exports) {
    naairis_create_function_fn naairis_create_function = (naairis_create_function_fn)node_symbol("naairis_create_function");
    naairis_set_named_property_fn naairis_set_named_property = (naairis_set_named_property_fn)node_symbol("naairis_set_named_property");

    naairis_value fn = 0;
    if (naairis_create_function &&
        naairis_set_named_property &&
        naairis_create_function(env, "enableVirtualTerminalInput", NAAIRIS_AUTO_LENGTH, enable_virtual_terminal_input, 0, &fn) == 0) {
        naairis_set_named_property(env, exports, "enableVirtualTerminalInput", fn);
    }

    return exports;
}
